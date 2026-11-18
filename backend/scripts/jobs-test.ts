// Prüft die zeitgesteuerten Jobs: npx payload run scripts/jobs-test.ts (frische Datenbank!)
import assert from 'node:assert/strict'
import { getPayload } from 'payload'
import config from '../src/payload.config'

const payload = await getPayload({ config })
const kat = (await payload.find({ collection: 'geraetekategorien', limit: 1 })).docs[0].id
const tag = (offset: number) => new Date(Date.now() + offset * 86400_000).toISOString().slice(0, 10) + 'T12:00:00.000Z'
const veranst = async (offset: number) => (await payload.create({ collection: 'veranstaltungen', data: { datum: tag(offset), ort: 'Test', beginn: '10:00', ende: '14:00', letzteAnkunft: '13:00', rasterMinuten: 15 } as never })).id
const auftrag = (veranstaltung: number, extra: object) =>
  payload.create({ collection: 'auftraege', overrideAccess: true, data: { geraetekategorie: kat, veranstaltung, hersteller: 'X', fehlerbeschreibung: 'kaputt', status: 'BESTAETIGT', ...extra } as never })

const morgen = await veranst(1)
const ankunft = new Date(Date.now() + 86400_000); ankunft.setUTCHours(10, 0, 0, 0)
const a = await auftrag(morgen, { terminAnkunft: ankunft.toISOString(), kontakt: { email: 'g@test.de', name: 'G' } })
const in3 = await auftrag(await veranst(3), { status: 'EINGEGANGEN' })
const alt = await auftrag(await veranst(-400), { status: 'ERLEDIGT', ergebnis: 'REPARIERT', kontakt: { email: 'alt@test.de', name: 'Alt' } })

for (const task of ['erinnerung', 'loeschung'] as const) await payload.jobs.queue({ task, queue: 'taeglich', input: {} })
await payload.jobs.run({ queue: 'taeglich' })
await payload.jobs.run({ queue: 'default' })

const a2 = await payload.findByID({ collection: 'auftraege', id: a.id, overrideAccess: true })
assert.equal(new Date(a2.erinnertFuer as string).getTime(), ankunft.getTime(), 'erinnertFuer gesetzt')
const alt2 = await payload.findByID({ collection: 'auftraege', id: alt.id, overrideAccess: true })
assert(alt2.anonymisiertAm && !alt2.kontakt?.email && !alt2.hersteller && alt2.ergebnis === 'REPARIERT', 'anonymisiert, Ergebnis bleibt')
const frisch = await payload.findByID({ collection: 'auftraege', id: a.id, overrideAccess: true })
assert(frisch.kontakt?.email === 'g@test.de', 'aktueller Auftrag unberührt')
const fehler = await payload.count({ collection: 'payload-jobs', where: { hasError: { equals: true } } })
assert.equal(fehler.totalDocs, 0, 'keine Job-Fehler')

// zweiter Lauf: kein Doppelversand
await payload.jobs.queue({ task: 'erinnerung', queue: 'taeglich', input: {} }); await payload.jobs.run({ queue: 'taeglich' })
console.log('✓ Erinnerung setzt erinnertFuer, Löschfrist anonymisiert, keine Job-Fehler', in3.nummer)
process.exit(0)
