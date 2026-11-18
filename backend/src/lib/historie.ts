import type { PayloadRequest } from 'payload'

export type Akteur = { typ: 'GAST' } | { typ: 'SYSTEM' } | { typ: 'BENUTZER'; id: number | string }

/**
 * Schreibt einen Historien-Eintrag. Kontaktänderungen werden nur als Aktion
 * („Kontakt geändert“) protokolliert, nie mit altem/neuem Klartext.
 */
export async function schreibeEreignis(
  req: PayloadRequest,
  auftragId: number | string,
  akteur: Akteur,
  aktion: string,
  vorher?: Record<string, unknown>,
  nachher?: Record<string, unknown>,
) {
  await req.payload.create({
    collection: 'ereignisse',
    data: {
      auftrag: Number(auftragId),
      zeitpunkt: new Date().toISOString(),
      akteurTyp: akteur.typ,
      akteur: akteur.typ === 'BENUTZER' ? Number(akteur.id) : undefined,
      aktion,
      vorher: vorher as never,
      nachher: nachher as never,
    },
    req,
    overrideAccess: true,
  })
}
