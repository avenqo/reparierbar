import type { Endpoint } from 'payload'
import { istAdmin, relId } from '../access'
import type { Geraetekategorie } from '../lib/typen'
import { ladeVeranstaltung } from '../lib/auftrag'
import { jsonAntwort, routenId } from '../lib/eingabe'
import { braucheReparista } from '../lib/rechte'
import { zeitBerlin } from '../lib/zeit'

const zeit = (d?: string | null) => (d ? zeitBerlin(new Date(d)) : null)

/** Öffentliche Belegung: nur Ankunftszeit, Kategorie, Hersteller, Typ, Status – keine Personendaten. */
export const belegungEndpoint: Endpoint = {
  path: '/:id/belegung',
  method: 'get',
  handler: async (req) => {
    const v = await ladeVeranstaltung(req, routenId(req))
    const res = await req.payload.find({
      collection: 'auftraege',
      where: { and: [{ veranstaltung: { equals: v.id } }, { status: { in: ['EINGEGANGEN', 'GEGENVORSCHLAG', 'BESTAETIGT'] } }] },
      depth: 1,
      pagination: false,
      req,
      overrideAccess: true,
    })
    const eintraege = res.docs
      .map((a) => {
        const bestaetigt = a.status === 'BESTAETIGT'
        const ankunft = bestaetigt ? a.terminAnkunft : a.wunschAnkunft
        return {
          ankunft: zeit(ankunft),
          sortierung: ankunft ?? '',
          geraetekategorie: (a.geraetekategorie as Geraetekategorie | null)?.name ?? null,
          hersteller: a.hersteller ?? null,
          typ: a.typ ?? null,
          status: bestaetigt ? 'BESTAETIGT' : 'ANGEFRAGT',
        }
      })
      .filter((e) => e.ankunft)
      .sort((x, y) => x.sortierung.localeCompare(y.sortierung))
      .map(({ sortierung: _s, ...rest }) => rest)
    return jsonAntwort({
      veranstaltung: { id: v.id, datum: v.datum, beginn: v.beginn, ende: v.ende, letzteAnkunft: v.letzteAnkunft, rasterMinuten: v.rasterMinuten, ort: v.ort, status: v.status },
      belegung: eintraege,
    })
  },
}

/** Tagesliste für Reparistas: alle Geräte des Tages mit Ankunftszeit, Verantwortlichem und Notizen. */
export const tageslisteEndpoint: Endpoint = {
  path: '/:id/tagesliste',
  method: 'get',
  handler: async (req) => {
    const user = braucheReparista(req)
    const v = await ladeVeranstaltung(req, routenId(req))
    const res = await req.payload.find({
      collection: 'auftraege',
      where: { and: [{ veranstaltung: { equals: v.id } }, { status: { not_equals: 'STORNIERT' } }] },
      depth: 1,
      pagination: false,
      req,
      overrideAccess: true,
    })
    const ids = res.docs.map((a) => a.id)
    const notizen = ids.length
      ? await req.payload.find({ collection: 'notizen', where: { auftrag: { in: ids } }, sort: 'createdAt', pagination: false, depth: 1, req, overrideAccess: true })
      : { docs: [] }
    const liste = res.docs
      .map((a) => {
        const verantwortlichId = relId(a.verantwortlich)
        const darfKontakt = istAdmin(user) || (verantwortlichId !== null && String(verantwortlichId) === String(user.id))
        const ankunft = a.status === 'BESTAETIGT' ? a.terminAnkunft : (a.wunschAnkunft ?? null)
        return {
          id: a.id,
          nummer: a.nummer,
          status: a.status,
          ankunft: zeit(ankunft),
          sortierung: ankunft ?? '9',
          geraetekategorie: (a.geraetekategorie as Geraetekategorie | null)?.name ?? null,
          hersteller: a.hersteller ?? null,
          typ: a.typ ?? null,
          fehlerbeschreibung: a.fehlerbeschreibung ?? null,
          verantwortlich: typeof a.verantwortlich === 'object' && a.verantwortlich ? { id: a.verantwortlich.id, name: a.verantwortlich.name } : null,
          vertretungGesucht: Boolean(a.vertretungGesucht),
          emailVorhanden: Boolean(a.emailVorhanden),
          kontakt: darfKontakt ? { name: a.kontakt?.name ?? null, email: a.kontakt?.email ?? null, telefon: a.kontakt?.telefon ?? null } : null,
          notizen: notizen.docs
            .filter((n) => String(relId(n.auftrag)) === String(a.id))
            .map((n) => ({ id: n.id, text: n.text, link: n.link ?? null, autor: typeof n.autor === 'object' && n.autor ? n.autor.name : null })),
        }
      })
      .sort((x, y) => x.sortierung.localeCompare(y.sortierung))
      .map(({ sortierung: _s, ...rest }) => rest)
    return jsonAntwort({ veranstaltung: { id: v.id, datum: v.datum, ort: v.ort }, auftraege: liste })
  },
}
