import { addDataAndFileToRequest, type Endpoint, type PayloadRequest } from 'payload'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { relId } from '../access'
import type { Auftrag, Bilder } from '../lib/typen'
import { ladeGastAuftrag, kurzSicht, legeAuftragAn, leseAnfrage, mitTransaktion, uebergang, type Status } from '../lib/auftrag'
import { einwilligungVersion, ladeEinstellungen } from '../lib/einstellungen'
import { emailFeld, idFeld, jsonAntwort, lies, textFeld } from '../lib/eingabe'
import { fehler } from '../lib/fehler'
import { schreibeEreignis } from '../lib/historie'
import { basisUrl, vorschlagZweck } from '../lib/mail'
import { bilderVerzeichnis } from '../lib/pfade'
import { hashEmail, pruefeAktionsToken } from '../lib/token'
import { zeitBerlin } from '../lib/zeit'

const AKTIV: Status[] = ['EINGEGANGEN', 'UEBERNOMMEN', 'GEGENVORSCHLAG', 'BESTAETIGT']

function zeit(d?: string | null) {
  return d ? zeitBerlin(new Date(d)) : null
}

async function gastSicht(req: PayloadRequest, a: Auftrag) {
  const [veranstaltung, bilder] = await Promise.all([
    req.payload.findByID({ collection: 'veranstaltungen', id: relId(a.veranstaltung) as number, depth: 0, req, overrideAccess: true }),
    req.payload.find({ collection: 'bilder', where: { auftrag: { equals: a.id } }, sort: 'reihenfolge', limit: 10, depth: 0, req, overrideAccess: true }),
  ])
  return {
    nummer: a.nummer,
    status: a.status,
    kanal: a.kanal,
    geraetekategorie: relId(a.geraetekategorie),
    hersteller: a.hersteller ?? null,
    typ: a.typ ?? null,
    fehlerbeschreibung: a.fehlerbeschreibung ?? null,
    veranstaltung: {
      id: veranstaltung.id,
      datum: veranstaltung.datum,
      beginn: veranstaltung.beginn,
      ende: veranstaltung.ende,
      ort: veranstaltung.ort,
    },
    wunschAnkunft: zeit(a.wunschAnkunft),
    terminAnkunft: zeit(a.terminAnkunft),
    vorschlagAnkunft: zeit(a.vorschlagAnkunft),
    ergebnis: a.ergebnis ?? null,
    kontakt: { name: a.kontakt?.name ?? null, email: a.kontakt?.email ?? null, telefon: a.kontakt?.telefon ?? null },
    bilder: bilder.docs.map((b) => ({ id: b.id, reihenfolge: b.reihenfolge ?? null })),
  }
}

/** Gast per Schlüssel-Header – oder per Aktions-Token aus der Mail (Gegenvorschlag annehmen/ablehnen). */
async function ladeFuerVorschlag(req: PayloadRequest, body: Record<string, unknown>): Promise<Auftrag> {
  if (req.headers.get('x-auftrag-schluessel')) return ladeGastAuftrag(req)
  const nummer = textFeld(body.nummer, 'Nummer', 40, true)
  const res = await req.payload.find({ collection: 'auftraege', where: { nummer: { equals: nummer } }, limit: 1, depth: 0, req, overrideAccess: true })
  const a = res.docs[0] as Auftrag | undefined
  if (!a || !pruefeAktionsToken(body.token, vorschlagZweck(a), a.id)) throw fehler(401, 'Der Link ist ungültig oder abgelaufen.')
  return a
}

const anfrage: Endpoint = {
  path: '/gast/anfrage',
  method: 'post',
  handler: async (req) => {
    const body = await lies(req)
    const e = leseAnfrage(body, false)
    const r = await legeAuftragAn(req, e, { kanal: body.kanal === 'WEB' ? 'WEB' : 'APP' })
    return jsonAntwort(
      {
        nummer: r.auftrag.nummer,
        status: r.auftrag.status,
        schluessel: r.schluessel,
        link: `${basisUrl()}/a/${r.auftrag.nummer}#t=${r.schluessel}`,
      },
      201,
    )
  },
}

const dasWarIchNicht: Endpoint = {
  path: '/gast/das-war-ich-nicht',
  method: 'post',
  handler: async (req) => {
    const body = await lies(req)
    const nummer = textFeld(body.nummer, 'Nummer', 40, true)
    const res = await req.payload.find({ collection: 'auftraege', where: { nummer: { equals: nummer } }, limit: 1, depth: 0, req, overrideAccess: true })
    const a = res.docs[0] as Auftrag | undefined
    if (!a || !pruefeAktionsToken(body.token, 'nicht-ich', a.id)) throw fehler(401, 'Der Link ist ungültig.')

    await mitTransaktion(req, async () => {
      const email = a.kontakt?.email
      if (email) {
        const h = hashEmail(email)
        const vorhanden = await req.payload.count({ collection: 'email-sperren', where: { emailHash: { equals: h } }, req, overrideAccess: true })
        if (!vorhanden.totalDocs) {
          await req.payload.create({ collection: 'email-sperren', data: { emailHash: h, gesperrtAm: new Date().toISOString() }, req, overrideAccess: true })
        }
      }
      if (AKTIV.includes(a.status as Status)) {
        await uebergang(req, {
          id: a.id,
          erlaubt: AKTIV,
          daten: { status: 'STORNIERT', kontakt: { name: null, email: null, telefon: null, einwilligungAm: null, einwilligungVersion: null } },
          aktion: 'das_war_ich_nicht',
          akteur: { typ: 'GAST' },
          nachher: { status: 'STORNIERT' },
          mails: [{ vorlage: 'storno', auftragId: a.id, extra: { vonGast: true } }],
        })
      } else {
        await schreibeEreignis(req, a.id, { typ: 'GAST' }, 'das_war_ich_nicht')
      }
    })
    return jsonAntwort({ ok: true })
  },
}

const auftragLesen: Endpoint = {
  path: '/gast/auftrag',
  method: 'get',
  handler: async (req) => jsonAntwort(await gastSicht(req, await ladeGastAuftrag(req))),
}

const auftragErgaenzen: Endpoint = {
  path: '/gast/auftrag',
  method: 'patch',
  handler: async (req) => {
    const a = await ladeGastAuftrag(req)
    const body = await lies(req)
    const daten: Record<string, unknown> = {}
    const felder: string[] = []
    const setze = (key: string, wert: string | undefined) => {
      daten[key] = wert ?? null
      felder.push(key)
    }
    if ('fehlerbeschreibung' in body) setze('fehlerbeschreibung', textFeld(body.fehlerbeschreibung, 'Fehlerbeschreibung', 2000))
    if ('hersteller' in body) setze('hersteller', textFeld(body.hersteller, 'Hersteller', 60))
    if ('typ' in body) setze('typ', textFeld(body.typ, 'Typ', 60))
    if (body.kontakt && typeof body.kontakt === 'object') {
      const k = body.kontakt as Record<string, unknown>
      const kontakt: Record<string, unknown> = {}
      if ('name' in k) kontakt.name = textFeld(k.name, 'Name', 100) ?? null
      if ('telefon' in k) kontakt.telefon = textFeld(k.telefon, 'Telefon', 40) ?? null
      if ('email' in k) {
        const email = emailFeld(k.email)
        if (email) {
          const gesperrt = await req.payload.count({ collection: 'email-sperren', where: { emailHash: { equals: hashEmail(email) } }, req, overrideAccess: true })
          if (gesperrt.totalDocs) throw fehler(403, 'Für diese E-Mail-Adresse sind keine Anmeldungen möglich.')
        }
        kontakt.email = email ?? null
      }
      if (Object.keys(kontakt).length) {
        if (!a.kontakt?.einwilligungAm) {
          if (body.einwilligung !== true) throw fehler(422, 'Für die Speicherung der Kontaktdaten ist eine Einwilligung nötig.')
          kontakt.einwilligungAm = new Date().toISOString()
          kontakt.einwilligungVersion = einwilligungVersion(await ladeEinstellungen(req))
        }
        daten.kontakt = kontakt
        felder.push('kontakt') // nur der Feldname wird protokolliert, nie der Wert
      }
    }
    if (!felder.length) throw fehler(400, 'Nichts zu ändern.')
    const neu = await uebergang(req, {
      id: a.id,
      erlaubt: AKTIV,
      daten,
      aktion: felder.includes('kontakt') ? 'ergaenzt (Kontakt geändert)' : 'ergaenzt',
      akteur: { typ: 'GAST' },
      nachher: { felder },
      konfliktText: 'Diese Anfrage kann nicht mehr geändert werden.',
    })
    return jsonAntwort(await gastSicht(req, neu))
  },
}

const bildHochladen: Endpoint = {
  path: '/gast/auftrag/bilder',
  method: 'post',
  handler: async (req) => {
    const a = await ladeGastAuftrag(req)
    if (!AKTIV.includes(a.status as Status)) throw fehler(409, 'Zu dieser Anfrage können keine Bilder mehr hinzugefügt werden.')
    await addDataAndFileToRequest(req)
    if (!req.file) throw fehler(400, 'Keine Bilddatei übermittelt (Formularfeld "file").')
    const bild = await mitTransaktion(req, async () => {
      const b = (await req.payload.create({
        collection: 'bilder',
        data: { auftrag: a.id },
        file: req.file,
        req,
        overrideAccess: true,
        depth: 0,
      })) as Bilder
      await schreibeEreignis(req, a.id, { typ: 'GAST' }, 'bild_hinzugefuegt')
      return b
    })
    return jsonAntwort({ id: bild.id, reihenfolge: bild.reihenfolge ?? null }, 201)
  },
}

const bildLoeschen: Endpoint = {
  path: '/gast/auftrag/bilder',
  method: 'delete',
  handler: async (req) => {
    const a = await ladeGastAuftrag(req)
    if (!AKTIV.includes(a.status as Status)) throw fehler(409, 'Bilder können nicht mehr entfernt werden.')
    const id = idFeld(req.searchParams.get('id'), 'Bild-ID')
    await mitTransaktion(req, async () => {
      const res = await req.payload.delete({
        collection: 'bilder',
        where: { and: [{ id: { equals: id } }, { auftrag: { equals: a.id } }] },
        req,
        overrideAccess: true,
      })
      if (!res.docs.length) throw fehler(404, 'Bild nicht gefunden.')
      await schreibeEreignis(req, a.id, { typ: 'GAST' }, 'bild_entfernt')
    })
    return jsonAntwort({ ok: true })
  },
}

const bildAbrufen: Endpoint = {
  path: '/gast/auftrag/bilder/:id',
  method: 'get',
  handler: async (req) => {
    const a = await ladeGastAuftrag(req)
    const id = idFeld(req.routeParams?.id, 'Bild-ID')
    const res = await req.payload.find({
      collection: 'bilder',
      where: { and: [{ id: { equals: id } }, { auftrag: { equals: a.id } }] },
      limit: 1,
      depth: 0,
      req,
      overrideAccess: true,
    })
    const b = res.docs[0] as Bilder | undefined
    if (!b?.filename) throw fehler(404, 'Bild nicht gefunden.')
    const vorschau = req.searchParams.get('groesse') !== 'original' && b.sizes?.vorschau?.filename
    const dateiname = path.basename(vorschau || b.filename)
    const daten = await readFile(path.join(bilderVerzeichnis(), dateiname)).catch(() => null)
    if (!daten) throw fehler(404, 'Bilddatei nicht gefunden.')
    return new Response(new Uint8Array(daten), {
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=300' },
    })
  },
}

const vorschlagAnnehmen: Endpoint = {
  path: '/gast/auftrag/vorschlag/annehmen',
  method: 'post',
  handler: async (req) => {
    const body = await lies(req)
    const a = await ladeFuerVorschlag(req, body)
    if (!a.vorschlagAnkunft) throw fehler(409, 'Es liegt kein Gegenvorschlag vor.')
    const neu = await uebergang(req, {
      id: a.id,
      erlaubt: ['GEGENVORSCHLAG'],
      daten: { status: 'BESTAETIGT', terminAnkunft: a.vorschlagAnkunft, vorschlagAnkunft: null },
      aktion: 'vorschlag_angenommen',
      akteur: { typ: 'GAST' },
      vorher: { status: 'GEGENVORSCHLAG' },
      nachher: { status: 'BESTAETIGT', terminAnkunft: zeit(a.vorschlagAnkunft) },
      mails: [
        { vorlage: 'vorschlag_beantwortet', auftragId: a.id, extra: { antwort: 'angenommen' } },
        { vorlage: 'bestaetigt', auftragId: a.id },
      ],
      konfliktText: 'Der Gegenvorschlag ist nicht mehr offen.',
    })
    return jsonAntwort(kurzSicht(neu))
  },
}

const vorschlagAblehnen: Endpoint = {
  path: '/gast/auftrag/vorschlag/ablehnen',
  method: 'post',
  handler: async (req) => {
    const body = await lies(req)
    const a = await ladeFuerVorschlag(req, body)
    // Die Verantwortung entfällt; die Mail braucht den bisherigen Verantwortlichen deshalb schon jetzt.
    const vId = relId(a.verantwortlich)
    const v = vId ? await req.payload.findByID({ collection: 'benutzer', id: vId, depth: 0, req, overrideAccess: true }).catch(() => null) : null
    const neu = await uebergang(req, {
      id: a.id,
      erlaubt: ['GEGENVORSCHLAG'],
      daten: { status: 'EINGEGANGEN', vorschlagAnkunft: null, verantwortlich: null },
      aktion: 'vorschlag_abgelehnt',
      akteur: { typ: 'GAST' },
      vorher: { status: 'GEGENVORSCHLAG' },
      nachher: { status: 'EINGEGANGEN' },
      mails: v ? [{ vorlage: 'vorschlag_beantwortet', auftragId: a.id, extra: { antwort: 'abgelehnt', an: [v.email] } }] : [],
      konfliktText: 'Der Gegenvorschlag ist nicht mehr offen.',
    })
    return jsonAntwort(kurzSicht(neu))
  },
}

const stornieren: Endpoint = {
  path: '/gast/auftrag/stornieren',
  method: 'post',
  handler: async (req) => {
    const a = await ladeGastAuftrag(req)
    const neu = await uebergang(req, {
      id: a.id,
      erlaubt: AKTIV,
      daten: { status: 'STORNIERT', vertretungGesucht: false },
      aktion: 'storniert',
      akteur: { typ: 'GAST' },
      vorher: { status: a.status },
      nachher: { status: 'STORNIERT' },
      mails: [{ vorlage: 'storno', auftragId: a.id, extra: { vonGast: true } }],
      konfliktText: 'Diese Anfrage ist bereits abgeschlossen oder storniert.',
    })
    return jsonAntwort(kurzSicht(neu))
  },
}

export const gastEndpoints: Endpoint[] = [
  anfrage,
  dasWarIchNicht,
  auftragLesen,
  auftragErgaenzen,
  bildHochladen,
  bildLoeschen,
  bildAbrufen,
  vorschlagAnnehmen,
  vorschlagAblehnen,
  stornieren,
]

