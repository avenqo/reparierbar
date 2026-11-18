import { commitTransaction, initTransaction, killTransaction, type PayloadRequest, type Where } from 'payload'
import { relId } from '../access'
import type { Auftrag, Veranstaltung } from './typen'
import { ladeEinstellungen } from './einstellungen'
import { fehler } from './fehler'
import { emailFeld, idFeld, textFeld } from './eingabe'
import { schreibeEreignis, type Akteur } from './historie'
import { reiheMailsEin, type MailJob } from './mail-queue'
import { pruefeAnkunft, TerminFehler, ueberschneidet, type VeranstaltungsZeiten } from './termin'
import { hashEmail, hashSchluessel, neuerSchluessel } from './token'
import { datumBerlin, zeitBerlin } from './zeit'

export type Status = NonNullable<Auftrag['status']>

export const MAX_ANFRAGEN_PRO_EMAIL_24H = 5

export async function mitTransaktion<T>(req: PayloadRequest, fn: () => Promise<T>): Promise<T> {
  const neu = await initTransaction(req)
  try {
    const ergebnis = await fn()
    if (neu) await commitTransaction(req)
    return ergebnis
  } catch (e) {
    if (neu) await killTransaction(req)
    throw e
  }
}

export function zeiten(v: Veranstaltung): VeranstaltungsZeiten {
  return {
    datum: datumBerlin(new Date(v.datum)),
    beginn: v.beginn,
    ende: v.ende,
    letzteAnkunft: v.letzteAnkunft,
    rasterMinuten: v.rasterMinuten,
  }
}

export function pruefeZeit(v: Veranstaltung, zeit: unknown): Date {
  try {
    return pruefeAnkunft(zeiten(v), zeit)
  } catch (e) {
    if (e instanceof TerminFehler) throw fehler(422, e.message)
    throw e
  }
}

export async function ladeVeranstaltung(req: PayloadRequest, id: number | string): Promise<Veranstaltung> {
  try {
    return (await req.payload.findByID({ collection: 'veranstaltungen', id, depth: 0, req, overrideAccess: true })) as Veranstaltung
  } catch {
    throw fehler(404, 'Veranstaltung nicht gefunden.')
  }
}

export async function ladeAuftrag(req: PayloadRequest, id: number | string, depth = 0): Promise<Auftrag> {
  try {
    return (await req.payload.findByID({ collection: 'auftraege', id, depth, req, overrideAccess: true, showHiddenFields: true })) as Auftrag
  } catch {
    throw fehler(404, 'Auftrag nicht gefunden.')
  }
}

/** Gast-Zugang: persönlicher Link-Schlüssel im Header X-Auftrag-Schluessel; in der DB nur als Hash. */
export async function ladeGastAuftrag(req: PayloadRequest): Promise<Auftrag> {
  const schluessel = req.headers.get('x-auftrag-schluessel')
  if (!schluessel || schluessel.length < 20 || schluessel.length > 200) throw fehler(401, 'Persönlicher Link fehlt oder ist ungültig.')
  const res = await req.payload.find({
    collection: 'auftraege',
    where: { linkSchluesselHash: { equals: hashSchluessel(schluessel) } },
    limit: 1,
    depth: 0,
    req,
    overrideAccess: true,
    showHiddenFields: true,
  })
  if (!res.docs[0]) throw fehler(401, 'Persönlicher Link fehlt oder ist ungültig.')
  return res.docs[0] as Auftrag
}

export type UebergangOptionen = {
  id: number | string
  erlaubt: Status[]
  daten: Record<string, unknown>
  aktion: string
  akteur: Akteur
  vorher?: Record<string, unknown>
  nachher?: Record<string, unknown>
  mails?: MailJob[]
  /** zusätzliche Bedingung am bedingten Update, z. B. nur der Verantwortliche */
  bedingung?: Where
  konfliktText?: string
}

/**
 * Bedingtes Update: ändert nur, solange der Auftrag in einem erlaubten Status ist, sonst 409.
 * Statuswechsel, Historien-Eintrag und Mail-Jobs laufen in einer Transaktion.
 */
export async function uebergang(req: PayloadRequest, o: UebergangOptionen): Promise<Auftrag> {
  return mitTransaktion(req, async () => {
    const where: Where = {
      and: [{ id: { equals: o.id } }, { status: { in: o.erlaubt } }, ...(o.bedingung ? [o.bedingung] : [])],
    }
    const res = await req.payload.update({
      collection: 'auftraege',
      where,
      data: o.daten as never,
      depth: 0,
      req,
      overrideAccess: true,
    })
    if (res.errors.length) throw fehler(500, 'Auftrag konnte nicht geändert werden.')
    const doc = res.docs[0] as Auftrag | undefined
    if (!doc) {
      await ladeAuftrag(req, o.id) // 404, falls es ihn nicht gibt
      throw fehler(409, o.konfliktText ?? 'Der Auftrag hat sich inzwischen geändert. Bitte neu laden.')
    }
    await schreibeEreignis(req, doc.id, o.akteur, o.aktion, o.vorher, o.nachher)
    if (o.mails?.length) await reiheMailsEin(req, o.mails.map((m) => ({ ...m, auftragId: doc.id })))
    return doc
  })
}

/** Warnung (keine Sperre), wenn sich zwei Zusagen eines Reparistas überschneiden. */
export async function findeUeberschneidungen(
  req: PayloadRequest,
  o: { benutzerId: number | string; veranstaltungId: number | string; ankunft: Date; dauer: number; ausserId?: number | string },
): Promise<string[]> {
  const res = await req.payload.find({
    collection: 'auftraege',
    where: {
      and: [
        { verantwortlich: { equals: o.benutzerId } },
        { status: { equals: 'BESTAETIGT' } },
        { veranstaltung: { equals: o.veranstaltungId } },
        ...(o.ausserId ? [{ id: { not_equals: o.ausserId } }] : []),
      ],
    },
    limit: 200,
    depth: 0,
    req,
    overrideAccess: true,
  })
  return res.docs
    .filter((d) => d.terminAnkunft && ueberschneidet(new Date(d.terminAnkunft), o.ankunft, Math.max(o.dauer, d.dauerMinuten ?? 60)))
    .map((d) => `${d.nummer} (${zeitBerlin(new Date(d.terminAnkunft as string))} Uhr)`)
}

export function warnText(nummern: string[]): string[] {
  return nummern.length ? [`Überschneidung mit eigener Zusage: ${nummern.join(', ')}`] : []
}

/** Knappe Sicht ohne Kontaktdaten – für Antworten der Fach-Endpunkte. */
export function kurzSicht(a: Auftrag) {
  const zeit = (d?: string | null) => (d ? zeitBerlin(new Date(d)) : null)
  return {
    id: a.id,
    nummer: a.nummer,
    status: a.status,
    veranstaltung: relId(a.veranstaltung),
    wunschAnkunft: zeit(a.wunschAnkunft),
    terminAnkunft: zeit(a.terminAnkunft),
    vorschlagAnkunft: zeit(a.vorschlagAnkunft),
    verantwortlich: relId(a.verantwortlich),
    vertretungGesucht: Boolean(a.vertretungGesucht),
    ergebnis: a.ergebnis ?? null,
  }
}

export type AnfrageEingabe = {
  geraetekategorie: number
  hersteller?: string
  typ?: string
  fehlerbeschreibung?: string
  veranstaltung: number
  wunschZeit?: string
  terminZeit?: string
  uebernehmen: boolean
  kontakt: { name?: string; email?: string; telefon?: string }
  einwilligung: boolean
}

export function leseAnfrage(body: Record<string, unknown>, telefon: boolean): AnfrageEingabe {
  const k = (body.kontakt && typeof body.kontakt === 'object' ? body.kontakt : {}) as Record<string, unknown>
  return {
    geraetekategorie: idFeld(body.geraetekategorie, 'Gerätekategorie'),
    hersteller: textFeld(body.hersteller, 'Hersteller', 60),
    typ: textFeld(body.typ, 'Typ', 60),
    fehlerbeschreibung: textFeld(body.fehlerbeschreibung, 'Fehlerbeschreibung', 2000, !telefon),
    veranstaltung: idFeld(body.veranstaltung, 'Veranstaltung'),
    wunschZeit: textFeld(body.wunschAnkunft, 'Wunsch-Ankunft', 5),
    terminZeit: telefon ? textFeld(body.terminAnkunft, 'Ankunft', 5) : undefined,
    uebernehmen: telefon && body.uebernehmen === true,
    kontakt: {
      name: textFeld(k.name, 'Name', 100),
      email: emailFeld(k.email),
      telefon: textFeld(k.telefon, 'Telefon', 40),
    },
    einwilligung: body.einwilligung === true,
  }
}

/**
 * Legt einen Auftrag an: Gast-Anfrage (ohne Login) oder telefonische Anmeldung (Reparista).
 * Gibt den persönlichen Schlüssel einmalig im Klartext zurück; gespeichert wird nur sein Hash.
 */
export async function legeAuftragAn(
  req: PayloadRequest,
  e: AnfrageEingabe,
  ctx: { kanal: 'APP' | 'WEB' | 'TELEFON'; benutzer?: { id: number | string } },
) {
  const reparista = Boolean(ctx.benutzer)
  const einstellungen = await ladeEinstellungen(req)
  const dauer = einstellungen.standardDauerMinuten
  const veranstaltung = await ladeVeranstaltung(req, e.veranstaltung)
  const heute = datumBerlin(new Date())
  if (veranstaltung.status !== 'GEPLANT') throw fehler(422, 'Für diese Veranstaltung sind keine Anmeldungen möglich.')
  if (datumBerlin(new Date(veranstaltung.datum)) < heute) throw fehler(422, 'Die Veranstaltung liegt in der Vergangenheit.')
  if (!reparista && veranstaltung.anmeldeschluss && new Date(veranstaltung.anmeldeschluss) < new Date()) {
    throw fehler(422, 'Der Anmeldeschluss ist vorbei.')
  }

  const kategorie = await req.payload.count({ collection: 'geraetekategorien', where: { id: { equals: e.geraetekategorie } }, req, overrideAccess: true })
  if (!kategorie.totalDocs) throw fehler(422, 'Unbekannte Gerätekategorie.')

  const { name, email, telefon } = e.kontakt
  const hatKontakt = Boolean(name || email || telefon)
  if (hatKontakt && !e.einwilligung) throw fehler(422, 'Für die Speicherung der Kontaktdaten ist eine Einwilligung nötig.')

  if (email) {
    const gesperrt = await req.payload.count({ collection: 'email-sperren', where: { emailHash: { equals: hashEmail(email) } }, req, overrideAccess: true })
    if (gesperrt.totalDocs) throw fehler(403, 'Für diese E-Mail-Adresse sind keine Anmeldungen möglich.')
    if (!reparista) {
      const seit = new Date(Date.now() - 24 * 3600_000).toISOString()
      const anzahl = await req.payload.count({
        collection: 'auftraege',
        where: { and: [{ 'kontakt.email': { equals: email } }, { createdAt: { greater_than: seit } }] },
        req,
        overrideAccess: true,
      })
      if (anzahl.totalDocs >= MAX_ANFRAGEN_PRO_EMAIL_24H) throw fehler(429, 'Zu viele Anfragen mit dieser E-Mail-Adresse. Bitte später erneut versuchen.')
    }
  }

  // Reservierung: Gäste nur mit E-Mail, Reparistas bei telefonischer Anmeldung auch ohne.
  if (e.wunschZeit && !email && !reparista) throw fehler(422, 'Eine Wunsch-Ankunftszeit gibt es nur mit E-Mail-Adresse.')
  const wunsch = e.wunschZeit ? pruefeZeit(veranstaltung, e.wunschZeit) : null
  const termin = e.terminZeit ? pruefeZeit(veranstaltung, e.terminZeit) : null

  const schluessel = neuerSchluessel()
  const akteur: Akteur = ctx.benutzer ? { typ: 'BENUTZER', id: ctx.benutzer.id } : { typ: 'GAST' }

  let status: Status = 'EINGEGANGEN'
  let verantwortlich: number | null = null
  if (termin) {
    status = 'BESTAETIGT'
    verantwortlich = Number(ctx.benutzer?.id)
  } else if (e.uebernehmen && ctx.benutzer) {
    status = 'UEBERNOMMEN'
    verantwortlich = Number(ctx.benutzer.id)
  }

  return mitTransaktion(req, async () => {
    const doc = (await req.payload.create({
      collection: 'auftraege',
      data: {
        status,
        kanal: ctx.kanal,
        angelegtVon: ctx.benutzer ? Number(ctx.benutzer.id) : undefined,
        geraetekategorie: e.geraetekategorie,
        hersteller: e.hersteller,
        typ: e.typ,
        fehlerbeschreibung: e.fehlerbeschreibung,
        veranstaltung: e.veranstaltung,
        wunschAnkunft: (wunsch ?? termin)?.toISOString(),
        terminAnkunft: termin?.toISOString(),
        dauerMinuten: dauer,
        verantwortlich,
        linkSchluesselHash: hashSchluessel(schluessel),
        kontakt: hatKontakt ? { name, email, telefon, einwilligungAm: new Date().toISOString() } : undefined,
      } as never,
      depth: 0,
      req,
      overrideAccess: true,
    })) as Auftrag

    await schreibeEreignis(req, doc.id, akteur, 'angelegt', undefined, { status, kanal: ctx.kanal })

    let warnungen: string[] = []
    if (termin && ctx.benutzer) {
      warnungen = warnText(await findeUeberschneidungen(req, { benutzerId: ctx.benutzer.id, veranstaltungId: e.veranstaltung, ankunft: termin, dauer, ausserId: doc.id }))
    }

    if (email) {
      const mails: MailJob[] = [{ vorlage: 'eingegangen', auftragId: doc.id, extra: { schluessel } }]
      if (termin) mails.push({ vorlage: 'bestaetigt', auftragId: doc.id })
      await reiheMailsEin(req, mails)
    }
    return { auftrag: doc, schluessel, warnungen }
  })
}
