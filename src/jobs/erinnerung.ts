import type { TaskConfig } from 'payload'
import { relId } from '../access'
import { reiheMailsEin } from '../lib/mail-queue'
import { berlinZuDate, datumPlusTage } from '../lib/zeit'

/**
 * Täglich 10:00 Uhr: Erinnerung am Vortag für bestätigte Termine, dazu Admin-Hinweis für
 * Anfragen, die 3 Tage vor der Veranstaltung noch unbestätigt sind.
 * `erinnertFuer` verhindert Doppelversand; wird der Termin verschoben, passt es nicht mehr.
 */
export const erinnerung: TaskConfig<'erinnerung'> = {
  slug: 'erinnerung',
  schedule: [{ cron: '0 10 * * *', queue: 'taeglich' }],
  handler: async ({ req }) => {
    const { payload } = req
    const jetzt = new Date()

    const tagesFenster = (tage: number) => {
      const d = datumPlusTage(jetzt, tage)
      return { von: berlinZuDate(d, '00:00').toISOString(), bis: berlinZuDate(datumPlusTage(jetzt, tage + 1), '00:00').toISOString() }
    }
    const veranstaltungenAm = async (tage: number) => {
      const f = tagesFenster(tage)
      const res = await payload.find({
        collection: 'veranstaltungen',
        where: { and: [{ datum: { greater_than_equal: f.von } }, { datum: { less_than: f.bis } }, { status: { equals: 'GEPLANT' } }] },
        pagination: false,
        depth: 0,
        req,
        overrideAccess: true,
      })
      return res.docs.map((v) => v.id)
    }

    let erinnert = 0
    const morgen = await veranstaltungenAm(1)
    if (morgen.length) {
      const res = await payload.find({
        collection: 'auftraege',
        where: { and: [{ veranstaltung: { in: morgen } }, { status: { equals: 'BESTAETIGT' } }] },
        pagination: false,
        depth: 0,
        req,
        overrideAccess: true,
      })
      for (const a of res.docs) {
        if (!a.terminAnkunft) continue
        if (a.erinnertFuer && new Date(a.erinnertFuer).getTime() === new Date(a.terminAnkunft).getTime()) continue
        const hatMailAdresse = Boolean(a.kontakt?.email) || relId(a.verantwortlich) !== null
        if (hatMailAdresse) await reiheMailsEin(req, [{ vorlage: 'erinnerung', auftragId: a.id }])
        await payload.update({ collection: 'auftraege', id: a.id, data: { erinnertFuer: a.terminAnkunft }, depth: 0, req, overrideAccess: true })
        erinnert++
      }
    }

    let hinweise = 0
    const inDreiTagen = await veranstaltungenAm(3)
    if (inDreiTagen.length) {
      const res = await payload.find({
        collection: 'auftraege',
        where: { and: [{ veranstaltung: { in: inDreiTagen } }, { status: { equals: 'EINGEGANGEN' } }] },
        pagination: false,
        depth: 0,
        req,
        overrideAccess: true,
      })
      for (const a of res.docs) {
        await reiheMailsEin(req, [{ vorlage: 'unbestaetigt_hinweis', auftragId: a.id }])
        hinweise++
      }
    }
    req.payload.logger.info(`Erinnerungen: ${erinnert}, Admin-Hinweise: ${hinweise}`)
    return { output: {} }
  },
}
