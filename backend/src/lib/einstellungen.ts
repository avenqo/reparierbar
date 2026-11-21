import { createHash } from 'node:crypto'
import type { PayloadRequest } from 'payload'

export type Instanz = {
  name: string
  nummernPraefix: string
  kontaktEmail: string | null
  webseiteUrl: string | null
  impressumUrl: string | null
  datenschutzUrl: string | null
  impressum: string | null
  datenschutz: string | null
  einwilligungstext: string
  farbePrimaer: string
  farbeAkzent: string
  farbeText: string
  logoUrl: string | null
  standardBeginn: string
  standardEnde: string
  standardLetzteAnkunft: string
  standardRaster: number
  standardDauerMinuten: number
  loeschfristMonate: number
}

/** Vorgaben, solange in den Einstellungen nichts anderes steht. */
export const STANDARD: Instanz = {
  name: process.env.INSTANZ_NAME || 'Repair Café',
  nummernPraefix: 'RC',
  kontaktEmail: null,
  webseiteUrl: null,
  impressumUrl: null,
  datenschutzUrl: null,
  impressum: null,
  datenschutz: null,
  einwilligungstext:
    'Ich bin damit einverstanden, dass meine Kontaktdaten (Name, E-Mail, Telefon) zur Abstimmung des Reparaturtermins gespeichert und für Mitteilungen zu meiner Anfrage verwendet werden. Sie werden nach Ablauf der Löschfrist nach dem Termin gelöscht. Details stehen in den Datenschutzhinweisen.',
  farbePrimaer: '#1e6f5c',
  farbeAkzent: '#f2a900',
  farbeText: '#1d2b2a',
  logoUrl: null,
  standardBeginn: '10:00',
  standardEnde: '14:00',
  standardLetzteAnkunft: '13:00',
  standardRaster: 15,
  standardDauerMinuten: 60,
  loeschfristMonate: 12,
}

/** Lädt die Einstellungen und füllt Lücken mit den Vorgaben. */
export async function ladeEinstellungen(req: PayloadRequest): Promise<Instanz> {
  try {
    const g = (await req.payload.findGlobal({ slug: 'einstellungen', depth: 0, req, overrideAccess: true })) as Partial<Record<keyof Instanz, unknown>>
    const ergebnis = { ...STANDARD } as Record<string, unknown>
    for (const key of Object.keys(STANDARD) as (keyof Instanz)[]) {
      const wert = g[key]
      if (wert !== undefined && wert !== null && wert !== '') ergebnis[key] = wert
    }
    return ergebnis as Instanz
  } catch {
    return STANDARD
  }
}

/** Version der Einwilligung: Kurz-Hash über Einwilligungstext und Datenschutzhinweise (wird am Auftrag mitgespeichert). */
export function einwilligungVersion(e: Pick<Instanz, 'einwilligungstext' | 'datenschutz'>): string {
  return createHash('sha256').update(`${e.einwilligungstext}\n---\n${e.datenschutz ?? ''}`).digest('hex').slice(0, 8)
}
