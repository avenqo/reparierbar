import type { Endpoint } from 'payload'
import { istAdmin, relId } from '../access'
import type { Auftrag } from '../lib/typen'
import {
  findeUeberschneidungen,
  kurzSicht,
  ladeAuftrag,
  ladeVeranstaltung,
  legeAuftragAn,
  leseAnfrage,
  pruefeZeit,
  uebergang,
  warnText,
} from '../lib/auftrag'
import { jsonAntwort, lies, routenId, textFeld } from '../lib/eingabe'
import { fehler } from '../lib/fehler'
import { braucheReparista } from '../lib/rechte'
import { ERGEBNISSE } from '../lib/konstanten'
import { zeitBerlin } from '../lib/zeit'

const zeit = (d?: string | null) => (d ? zeitBerlin(new Date(d)) : null)
const hatEmail = (a: Auftrag) => Boolean(a.kontakt?.email)

const telefon: Endpoint = {
  path: '/telefon',
  method: 'post',
  handler: async (req) => {
    const user = braucheReparista(req)
    const e = leseAnfrage(await lies(req), true)
    const r = await legeAuftragAn(req, e, { kanal: 'TELEFON', benutzer: user })
    return jsonAntwort({ ...kurzSicht(r.auftrag), schluessel: r.schluessel, warnungen: r.warnungen }, 201)
  },
}

const bestaetigen: Endpoint = {
  path: '/:id/bestaetigen',
  method: 'post',
  handler: async (req) => {
    const user = braucheReparista(req)
    const a = await ladeAuftrag(req, routenId(req))
    if (!a.wunschAnkunft) throw fehler(422, 'Der Auftrag hat keine Wunsch-Ankunftszeit. Bitte „übernehmen“ oder Gegenvorschlag nutzen.')
    const neu = await uebergang(req, {
      id: a.id,
      erlaubt: ['EINGEGANGEN'],
      daten: { status: 'BESTAETIGT', terminAnkunft: a.wunschAnkunft, vorschlagAnkunft: null, verantwortlich: user.id, vertretungGesucht: false },
      aktion: 'bestaetigt',
      akteur: { typ: 'BENUTZER', id: user.id },
      vorher: { status: a.status },
      nachher: { status: 'BESTAETIGT', terminAnkunft: zeit(a.wunschAnkunft) },
      mails: hatEmail(a) ? [{ vorlage: 'bestaetigt', auftragId: a.id }] : [],
      konfliktText: 'Der Auftrag ist schon vergeben oder nicht mehr offen.',
    })
    const warnungen = warnText(
      await findeUeberschneidungen(req, { benutzerId: user.id, veranstaltungId: relId(a.veranstaltung)!, ankunft: new Date(a.wunschAnkunft), dauer: a.dauerMinuten ?? 60, ausserId: a.id }),
    )
    return jsonAntwort({ auftrag: kurzSicht(neu), warnungen })
  },
}

const gegenvorschlag: Endpoint = {
  path: '/:id/gegenvorschlag',
  method: 'post',
  handler: async (req) => {
    const user = braucheReparista(req)
    const body = await lies(req)
    const a = await ladeAuftrag(req, routenId(req))
    if (!hatEmail(a)) throw fehler(422, 'Ein Gegenvorschlag geht nur, wenn der Gast eine E-Mail-Adresse angegeben hat.')
    const v = await ladeVeranstaltung(req, relId(a.veranstaltung)!)
    const ankunft = pruefeZeit(v, body.ankunft)
    const neu = await uebergang(req, {
      id: a.id,
      erlaubt: ['EINGEGANGEN'],
      daten: { status: 'GEGENVORSCHLAG', vorschlagAnkunft: ankunft.toISOString(), verantwortlich: user.id },
      aktion: 'gegenvorschlag',
      akteur: { typ: 'BENUTZER', id: user.id },
      vorher: { status: a.status },
      nachher: { status: 'GEGENVORSCHLAG', vorschlagAnkunft: zeit(ankunft.toISOString()) },
      mails: [{ vorlage: 'gegenvorschlag', auftragId: a.id }],
      konfliktText: 'Der Auftrag ist schon vergeben oder nicht mehr offen.',
    })
    const warnungen = warnText(await findeUeberschneidungen(req, { benutzerId: user.id, veranstaltungId: v.id, ankunft, dauer: a.dauerMinuten ?? 60, ausserId: a.id }))
    return jsonAntwort({ auftrag: kurzSicht(neu), warnungen })
  },
}

const termin: Endpoint = {
  path: '/:id/termin',
  method: 'post',
  handler: async (req) => {
    const user = braucheReparista(req)
    const body = await lies(req)
    const grund = textFeld(body.grund, 'Grund', 500, true)
    const a = await ladeAuftrag(req, routenId(req))
    const v = await ladeVeranstaltung(req, relId(a.veranstaltung)!)
    const ankunft = pruefeZeit(v, body.ankunft)
    const neu = await uebergang(req, {
      id: a.id,
      erlaubt: ['BESTAETIGT'],
      daten: { terminAnkunft: ankunft.toISOString() }, // Verantwortung bleibt beim bisherigen Reparista
      aktion: 'termin_geaendert',
      akteur: { typ: 'BENUTZER', id: user.id },
      vorher: { terminAnkunft: zeit(a.terminAnkunft) },
      nachher: { terminAnkunft: zeit(ankunft.toISOString()), grund },
      mails: hatEmail(a) ? [{ vorlage: 'termin_geaendert', auftragId: a.id, extra: { alt: zeit(a.terminAnkunft), grund } }] : [],
      konfliktText: 'Nur bestätigte Termine lassen sich ändern.',
    })
    const verantwortlich = relId(neu.verantwortlich)
    const warnungen = verantwortlich
      ? warnText(await findeUeberschneidungen(req, { benutzerId: verantwortlich, veranstaltungId: v.id, ankunft, dauer: a.dauerMinuten ?? 60, ausserId: a.id }))
      : []
    return jsonAntwort({ auftrag: kurzSicht(neu), warnungen })
  },
}

const uebernehmen: Endpoint = {
  path: '/:id/uebernehmen',
  method: 'post',
  handler: async (req) => {
    const user = braucheReparista(req)
    const a = await ladeAuftrag(req, routenId(req))
    if (a.status === 'BESTAETIGT') {
      // Vertretung für einen bestätigten Termin
      if (!a.vertretungGesucht) throw fehler(409, 'Für diesen Termin ist schon jemand zuständig.')
      const neu = await uebergang(req, {
        id: a.id,
        erlaubt: ['BESTAETIGT'],
        bedingung: { vertretungGesucht: { equals: true } },
        daten: { verantwortlich: user.id, vertretungGesucht: false },
        aktion: 'vertretung_uebernommen',
        akteur: { typ: 'BENUTZER', id: user.id },
        nachher: { verantwortlich: user.id },
        konfliktText: 'Jemand anderes war schneller.',
      })
      return jsonAntwort({ auftrag: kurzSicht(neu), warnungen: [] })
    }
    if (a.wunschAnkunft) throw fehler(422, 'Der Auftrag hat eine Wunsch-Ankunftszeit: bitte bestätigen oder einen Gegenvorschlag machen.')
    const neu = await uebergang(req, {
      id: a.id,
      erlaubt: ['EINGEGANGEN'],
      daten: { status: 'UEBERNOMMEN', verantwortlich: user.id },
      aktion: 'uebernommen',
      akteur: { typ: 'BENUTZER', id: user.id },
      vorher: { status: a.status },
      nachher: { status: 'UEBERNOMMEN' },
      mails: hatEmail(a) ? [{ vorlage: 'uebernommen', auftragId: a.id }] : [],
      konfliktText: 'Der Auftrag ist schon vergeben oder nicht mehr offen.',
    })
    return jsonAntwort({ auftrag: kurzSicht(neu), warnungen: [] })
  },
}

const abgeben: Endpoint = {
  path: '/:id/abgeben',
  method: 'post',
  handler: async (req) => {
    const user = braucheReparista(req)
    const a = await ladeAuftrag(req, routenId(req))
    const verantwortlich = relId(a.verantwortlich)
    if (verantwortlich === null || (String(verantwortlich) !== String(user.id) && !istAdmin(user))) {
      throw fehler(403, 'Nur der Verantwortliche kann die Verantwortung abgeben.')
    }
    const bedingung = { verantwortlich: { equals: verantwortlich } }
    if (a.status === 'BESTAETIGT') {
      // Der Termin bleibt bestehen; Admins bekommen den Hinweis „Vertretung gesucht“.
      const neu = await uebergang(req, {
        id: a.id,
        erlaubt: ['BESTAETIGT'],
        bedingung,
        daten: { verantwortlich: null, vertretungGesucht: true },
        aktion: 'verantwortung_abgegeben',
        akteur: { typ: 'BENUTZER', id: user.id },
        nachher: { vertretungGesucht: true },
        mails: [{ vorlage: 'vertretung_gesucht', auftragId: a.id }],
      })
      return jsonAntwort({ auftrag: kurzSicht(neu), warnungen: [] })
    }
    const neu = await uebergang(req, {
      id: a.id,
      erlaubt: ['UEBERNOMMEN', 'GEGENVORSCHLAG'],
      bedingung,
      daten: { status: 'EINGEGANGEN', verantwortlich: null, vorschlagAnkunft: null },
      aktion: 'verantwortung_abgegeben',
      akteur: { typ: 'BENUTZER', id: user.id },
      vorher: { status: a.status },
      nachher: { status: 'EINGEGANGEN' },
      konfliktText: 'In diesem Zustand kann die Verantwortung nicht abgegeben werden.',
    })
    return jsonAntwort({ auftrag: kurzSicht(neu), warnungen: [] })
  },
}

const abschliessen: Endpoint = {
  path: '/:id/abschliessen',
  method: 'post',
  handler: async (req) => {
    const user = braucheReparista(req)
    const body = await lies(req)
    const ergebnis = String(body.ergebnis ?? '')
    if (!(ERGEBNISSE as readonly string[]).includes(ergebnis)) {
      throw fehler(422, `Ergebnis muss eines von ${ERGEBNISSE.join(', ')} sein.`)
    }
    const a = await ladeAuftrag(req, routenId(req))
    const neu = await uebergang(req, {
      id: a.id,
      erlaubt: ['BESTAETIGT', 'UEBERNOMMEN'],
      daten: { status: 'ERLEDIGT', ergebnis, vertretungGesucht: false },
      aktion: 'abgeschlossen',
      akteur: { typ: 'BENUTZER', id: user.id },
      vorher: { status: a.status },
      nachher: { status: 'ERLEDIGT', ergebnis },
      konfliktText: 'Nur übernommene oder bestätigte Aufträge lassen sich abschließen.',
    })
    return jsonAntwort({ auftrag: kurzSicht(neu), warnungen: [] })
  },
}

const stornierenReparista: Endpoint = {
  path: '/:id/stornieren',
  method: 'post',
  handler: async (req) => {
    const user = braucheReparista(req)
    const body = await lies(req)
    const grund = textFeld(body.grund, 'Grund', 500)
    const a = await ladeAuftrag(req, routenId(req))
    const neu = await uebergang(req, {
      id: a.id,
      erlaubt: ['EINGEGANGEN', 'UEBERNOMMEN', 'GEGENVORSCHLAG', 'BESTAETIGT'],
      daten: { status: 'STORNIERT', vertretungGesucht: false },
      aktion: 'storniert',
      akteur: { typ: 'BENUTZER', id: user.id },
      vorher: { status: a.status },
      nachher: { status: 'STORNIERT', grund },
      mails: hatEmail(a) ? [{ vorlage: 'storno', auftragId: a.id, extra: { grund } }] : [],
      konfliktText: 'Der Auftrag ist bereits abgeschlossen oder storniert.',
    })
    return jsonAntwort({ auftrag: kurzSicht(neu), warnungen: [] })
  },
}

export const auftragEndpoints: Endpoint[] = [telefon, bestaetigen, gegenvorschlag, termin, uebernehmen, abgeben, abschliessen, stornierenReparista]
