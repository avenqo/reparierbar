import type { TaskConfig } from 'payload'
import { LOESCHFRIST_MONATE } from '../lib/konstanten'

/**
 * Nachts: 12 Monate nach dem Termin werden Kontaktdaten, Freitexte, Bilder und Notizen gelöscht.
 * Gerätekategorie, Veranstaltung, Status und Ergebnis bleiben anonym für die Reparaturstatistik.
 */
export const loeschung: TaskConfig<'loeschung'> = {
  slug: 'loeschung',
  schedule: [{ cron: '30 3 * * *', queue: 'taeglich' }],
  handler: async ({ req }) => {
    const { payload } = req
    const grenze = new Date()
    grenze.setMonth(grenze.getMonth() - LOESCHFRIST_MONATE)

    const res = await payload.find({
      collection: 'auftraege',
      where: { and: [{ 'veranstaltung.datum': { less_than: grenze.toISOString() } }, { anonymisiertAm: { exists: false } }] },
      pagination: false,
      depth: 0,
      req,
      overrideAccess: true,
    })
    for (const a of res.docs) {
      await payload.delete({ collection: 'bilder', where: { auftrag: { equals: a.id } }, req, overrideAccess: true })
      await payload.delete({ collection: 'notizen', where: { auftrag: { equals: a.id } }, req, overrideAccess: true })
      await payload.update({
        collection: 'auftraege',
        id: a.id,
        data: {
          kontakt: { name: null, email: null, telefon: null, einwilligungAm: null },
          hersteller: null,
          typ: null,
          fehlerbeschreibung: null,
          linkSchluesselHash: null,
          emailVorhanden: false,
          anonymisiertAm: new Date().toISOString(),
        } as never,
        depth: 0,
        req,
        overrideAccess: true,
      })
    }
    payload.logger.info(`Anonymisiert: ${res.docs.length} Aufträge`)
    return { output: {} }
  },
}
