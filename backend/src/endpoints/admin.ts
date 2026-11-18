import type { Endpoint } from 'payload'
import { jsonAntwort, lies } from '../lib/eingabe'
import { fehler } from '../lib/fehler'
import { braucheAdmin } from '../lib/rechte'
import { berlinZuDate } from '../lib/zeit'

/** Alle Aufträge vor einem Datum löschen (inkl. Bilder, Notizen, Historie über den beforeDelete-Hook). */
export const bereinigung: Endpoint = {
  path: '/admin/bereinigung',
  method: 'post',
  handler: async (req) => {
    braucheAdmin(req)
    const body = await lies(req)
    const vor = String(body.vorDatum ?? '')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(vor)) throw fehler(400, 'vorDatum muss im Format YYYY-MM-DD angegeben werden.')
    const dryRun = body.dryRun !== false // ohne ausdrückliches false wird nur gezählt
    const grenze = berlinZuDate(vor, '00:00').toISOString()
    const where = { 'veranstaltung.datum': { less_than: grenze } }

    const treffer = await req.payload.find({ collection: 'auftraege', where, depth: 0, pagination: false, req, overrideAccess: true })
    const nummern = treffer.docs.map((a) => a.nummer)
    if (!dryRun) {
      const res = await req.payload.delete({ collection: 'auftraege', where, req, overrideAccess: true })
      if (res.errors.length) throw fehler(500, 'Nicht alle Aufträge konnten gelöscht werden.')
    }
    return jsonAntwort({ dryRun, anzahl: nummern.length, nummern })
  },
}

export const health: Endpoint = {
  path: '/health',
  method: 'get',
  handler: async (req) => {
    try {
      await req.payload.count({ collection: 'geraetekategorien', req, overrideAccess: true })
      return jsonAntwort({ status: 'ok' })
    } catch {
      return jsonAntwort({ status: 'fehler' }, 503)
    }
  },
}
