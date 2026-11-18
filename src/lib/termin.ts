import { berlinZuDate, istZeit, minutenSeit } from './zeit'

export type VeranstaltungsZeiten = {
  datum: string // YYYY-MM-DD (Berliner Datum)
  beginn: string
  ende: string
  letzteAnkunft: string
  rasterMinuten: number
}

export class TerminFehler extends Error {}

/** Prüft eine Wunsch-/Terminzeit 'HH:mm' gegen die Veranstaltung und liefert den Zeitpunkt. */
export function pruefeAnkunft(v: VeranstaltungsZeiten, zeit: unknown): Date {
  if (!istZeit(zeit)) throw new TerminFehler('Ankunftszeit muss im Format HH:mm angegeben werden.')
  const min = minutenSeit(zeit)
  if (min < minutenSeit(v.beginn) || min > minutenSeit(v.letzteAnkunft)) {
    throw new TerminFehler(`Ankunft ist nur zwischen ${v.beginn} und ${v.letzteAnkunft} Uhr möglich.`)
  }
  const raster = v.rasterMinuten > 0 ? v.rasterMinuten : 15
  if ((min - minutenSeit(v.beginn)) % raster !== 0) {
    throw new TerminFehler(`Ankunftszeiten gibt es im ${raster}-Minuten-Raster.`)
  }
  return berlinZuDate(v.datum, zeit)
}

/** Zwei Termine überschneiden sich, wenn ihr Abstand kleiner als die Dauer ist. */
export function ueberschneidet(a: Date, b: Date, dauerMinuten: number): boolean {
  return Math.abs(a.getTime() - b.getTime()) < dauerMinuten * 60_000
}
