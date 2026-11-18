import type { Payload } from 'payload'

const KATEGORIEN = ['Haushaltsgeräte', 'Elektronik & Computer', 'Audio & Video', 'Werkzeug & Garten', 'Fahrrad & Mobilität', 'Textil & Kleidung', 'Spielzeug', 'Möbel & Holz', 'Sonstiges']

/** Beim ersten Start: Gerätekategorien als Vorschlag anlegen (danach frei pflegbar). */
export async function seed(payload: Payload) {
  const vorhanden = await payload.count({ collection: 'geraetekategorien', overrideAccess: true })
  if (vorhanden.totalDocs > 0) return
  for (const [i, name] of KATEGORIEN.entries()) {
    await payload.create({ collection: 'geraetekategorien', data: { name, reihenfolge: (i + 1) * 10 }, overrideAccess: true })
  }
  payload.logger.info(`${KATEGORIEN.length} Gerätekategorien angelegt`)
}
