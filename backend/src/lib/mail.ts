import type { PayloadRequest } from 'payload'
import type { Auftrag, Benutzer, Geraetekategorie, Veranstaltung } from './typen'
import { ladeEinstellungen, type Instanz } from './einstellungen'
import { erzeugeIcs } from './ics'
import type { MailVorlage } from './mail-queue'
import { aktionsToken } from './token'
import { zeitBerlin } from './zeit'

export const basisUrl = () => (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '')

/** Zweck-Kennung für Annehmen/Ablehnen-Links; ändert sich mit dem Vorschlag, alte Links verfallen. */
export const vorschlagZweck = (a: { vorschlagAnkunft?: string | null }) => `vorschlag:${a.vorschlagAnkunft ?? ''}`

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

type Aufgeloest = Omit<Auftrag, 'veranstaltung' | 'verantwortlich' | 'geraetekategorie'> & {
  veranstaltung: Veranstaltung
  verantwortlich?: Benutzer | null
  geraetekategorie: Geraetekategorie
}

type Mail = {
  an: string[]
  betreff: string
  zeilen: string[]
  links?: { text: string; url: string }[]
  ics?: string
}

const datumLang = (d: string) =>
  new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(d))

function geraet(a: Aufgeloest): string {
  return [a.geraetekategorie?.name, a.hersteller, a.typ].filter(Boolean).join(' · ')
}

function terminZeile(a: Aufgeloest, zeitpunkt: string | null | undefined): string {
  if (!zeitpunkt) return ''
  return `${datumLang(a.veranstaltung.datum)}, Ankunft ${zeitBerlin(new Date(zeitpunkt))} Uhr, ${a.veranstaltung.ort}`
}

function ladeIcs(a: Aufgeloest, inst: Instanz, abgesagt = false): string | undefined {
  if (!a.terminAnkunft) return undefined
  return erzeugeIcs({
    nummer: a.nummer as string,
    beginn: new Date(a.terminAnkunft),
    dauerMinuten: a.dauerMinuten ?? 60,
    ort: a.veranstaltung.ort,
    zusammenfassung: inst.name,
    domain: new URL(basisUrl()).hostname,
    beschreibung: `Auftrag ${a.nummer}: ${geraet(a)}`,
    abgesagt,
  })
}

async function adminAdressen(req: PayloadRequest): Promise<string[]> {
  const res = await req.payload.find({
    collection: 'benutzer',
    where: { and: [{ rolle: { equals: 'ADMIN' } }, { aktiv: { equals: true } }] },
    limit: 50,
    depth: 0,
    req,
    overrideAccess: true,
  })
  return res.docs.map((u) => u.email)
}

async function baue(req: PayloadRequest, inst: Instanz, vorlage: MailVorlage, a: Aufgeloest, extra: Record<string, unknown>): Promise<Mail | null> {
  const gast = a.kontakt?.email ? [a.kontakt.email] : []
  const hallo = a.kontakt?.name ? `Hallo ${a.kontakt.name},` : 'Hallo,'
  const nr = a.nummer as string
  const verantwortlich = a.verantwortlich?.email ? [a.verantwortlich.email] : []
  const nichtIch = {
    text: 'Das war ich nicht',
    url: `${basisUrl()}/a/${nr}#n=${aktionsToken('nicht-ich', a.id)}`,
  }

  switch (vorlage) {
    case 'eingegangen':
      if (!gast.length) return null
      return {
        an: gast,
        betreff: `Deine Anfrage ${nr} bei ${inst.name}`,
        zeilen: [
          hallo,
          `deine Anfrage ist eingegangen (${nr}).`,
          `Gerät: ${geraet(a)}`,
          a.wunschAnkunft ? `Gewünschter Termin: ${terminZeile(a, a.wunschAnkunft)}. Er ist erst verbindlich, wenn ein Reparista ihn bestätigt.` : `Veranstaltung: ${datumLang(a.veranstaltung.datum)}, ${a.veranstaltung.ort}. Ohne Wunsch-Ankunftszeit gibt es keine Reservierung.`,
          'Mit dem persönlichen Link kannst du deine Anfrage ansehen, ergänzen oder zurückziehen. Bitte gib ihn nicht weiter.',
        ],
        links: [
          ...(typeof extra.schluessel === 'string' ? [{ text: 'Meine Anfrage ansehen', url: `${basisUrl()}/a/${nr}#t=${extra.schluessel}` }] : []),
          nichtIch,
        ],
      }
    case 'uebernommen':
      if (!gast.length) return null
      return {
        an: gast,
        betreff: `Dein Gerät wird vorbereitet (${nr})`,
        zeilen: [hallo, `ein Reparista bereitet sich auf dein Gerät vor: ${geraet(a)}.`, 'Du musst nichts weiter tun.'],
      }
    case 'bestaetigt':
      if (!gast.length) return null
      return {
        an: gast,
        betreff: `Termin bestätigt: ${nr}`,
        zeilen: [hallo, `dein Termin ist bestätigt: ${terminZeile(a, a.terminAnkunft)}.`, `Gerät: ${geraet(a)}`, 'Bitte bring das Gerät samt Zubehör mit. Der Kalendereintrag hängt an.'],
        ics: ladeIcs(a, inst),
      }
    case 'gegenvorschlag': {
      if (!gast.length) return null
      const t = aktionsToken(vorschlagZweck(a), a.id)
      return {
        an: gast,
        betreff: `Gegenvorschlag für deinen Termin (${nr})`,
        zeilen: [
          hallo,
          `statt ${a.wunschAnkunft ? zeitBerlin(new Date(a.wunschAnkunft)) + ' Uhr' : 'deinem Wunsch'} schlägt das Team vor: ${terminZeile(a, a.vorschlagAnkunft)}.`,
          'Passt dir das?',
        ],
        links: [
          { text: 'Annehmen', url: `${basisUrl()}/a/${nr}#v=${t}&aktion=annehmen` },
          { text: 'Ablehnen', url: `${basisUrl()}/a/${nr}#v=${t}&aktion=ablehnen` },
        ],
      }
    }
    case 'termin_geaendert':
      if (!gast.length) return null
      return {
        an: gast,
        betreff: `Dein Termin wurde geändert (${nr})`,
        zeilen: [
          hallo,
          `dein Termin hat sich geändert.`,
          `Vorher: ${extra.alt ? String(extra.alt) + ' Uhr' : '–'}`,
          `Jetzt: ${terminZeile(a, a.terminAnkunft)}`,
          ...(extra.grund ? [`Grund: ${String(extra.grund)}`] : []),
        ],
        ics: ladeIcs(a, inst),
      }
    case 'erinnerung': {
      const an = [...gast, ...verantwortlich]
      if (!an.length) return null
      return {
        an,
        betreff: `Erinnerung: ${inst.name} morgen (${nr})`,
        zeilen: [
          'Hallo,',
          `morgen ist es soweit: ${terminZeile(a, a.terminAnkunft)}.`,
          `Gerät: ${geraet(a)}`,
          'Bitte Gerät und Zubehör mitbringen.',
        ],
        ics: ladeIcs(a, inst),
      }
    }
    case 'vorschlag_beantwortet': {
      const empfaenger = Array.isArray(extra.an) ? (extra.an as string[]) : verantwortlich
      if (!empfaenger.length) return null
      const antwort = String(extra.antwort ?? '')
      return {
        an: empfaenger,
        betreff: `${nr}: Gast hat auf deinen Gegenvorschlag geantwortet`,
        zeilen: [
          'Hallo,',
          antwort === 'angenommen' ? `der Gast hat deinen Vorschlag angenommen: ${terminZeile(a, a.terminAnkunft)}.` : 'der Gast hat deinen Vorschlag abgelehnt. Der Auftrag ist wieder offen.',
          `Gerät: ${geraet(a)}`,
        ],
      }
    }
    case 'storno': {
      const an = [...gast]
      const intern = extra.vonGast ? verantwortlich : []
      const alle = [...an, ...intern]
      if (!alle.length) return null
      return {
        an: alle,
        betreff: `Storniert: ${nr}`,
        zeilen: [
          'Hallo,',
          extra.vonGast ? `die Anfrage ${nr} (${geraet(a)}) wurde vom Gast zurückgezogen.` : `die Anfrage ${nr} (${geraet(a)}) wurde storniert.`,
          ...(extra.grund ? [`Grund: ${String(extra.grund)}`] : []),
        ],
        ics: a.terminAnkunft ? ladeIcs(a, inst, true) : undefined,
      }
    }
    case 'vertretung_gesucht': {
      const an = await adminAdressen(req)
      if (!an.length) return null
      return {
        an,
        betreff: `Vertretung gesucht: ${nr}`,
        zeilen: ['Hallo,', `für ${nr} (${geraet(a)}) wird eine Vertretung gesucht. Termin: ${terminZeile(a, a.terminAnkunft)}.`],
      }
    }
    case 'unbestaetigt_hinweis': {
      const an = await adminAdressen(req)
      if (!an.length) return null
      return {
        an,
        betreff: `Noch unbestätigte Anfrage: ${nr}`,
        zeilen: ['Hallo,', `${nr} (${geraet(a)}) ist in 3 Tagen (${datumLang(a.veranstaltung.datum)}) und noch nicht bestätigt.`],
      }
    }
  }
}

export async function versendeVorlage(
  req: PayloadRequest,
  input: { vorlage: MailVorlage; auftragId: number | string; extra?: Record<string, unknown> },
): Promise<void> {
  let a: Aufgeloest
  try {
    a = (await req.payload.findByID({ collection: 'auftraege', id: input.auftragId, depth: 1, req, overrideAccess: true })) as unknown as Aufgeloest
  } catch {
    return // Auftrag inzwischen gelöscht
  }
  const inst = await ladeEinstellungen(req)
  const mail = await baue(req, inst, input.vorlage, a, input.extra ?? {})
  if (!mail) return

  const text = [...mail.zeilen, ...(mail.links ?? []).map((l) => `${l.text}: ${l.url}`), '', inst.name].join('\n\n')
  const html =
    mail.zeilen.map((z) => `<p>${esc(z)}</p>`).join('') +
    (mail.links?.length ? `<p>${mail.links.map((l) => `<a href="${esc(l.url)}">${esc(l.text)}</a>`).join(' · ')}</p>` : '') +
    `<p>${esc(inst.name)}</p>`

  await req.payload.sendEmail({
    from: `"${inst.name.replace(/"/g, '')}" <${process.env.MAIL_FROM || 'noreply@localhost'}>`,
    to: mail.an,
    subject: mail.betreff,
    text,
    html,
    ...(mail.ics ? { attachments: [{ filename: 'repair-cafe.ics', content: mail.ics, contentType: 'text/calendar; charset=utf-8' }] } : {}),
  })
}
