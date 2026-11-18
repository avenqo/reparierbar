/**
 * Zeit-Hilfen für Europe/Berlin. Veranstaltungen laufen immer in lokaler Zeit
 * (10:00–14:00 Uhr); gespeichert wird als UTC-Zeitpunkt.
 */
const ZONE = 'Europe/Berlin'

function berlinOffsetMs(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'))
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/** 'YYYY-MM-DD' + 'HH:mm' (Berliner Ortszeit) → Date */
export function berlinZuDate(datum: string, zeit: string): Date {
  const [y, m, d] = datum.split('-').map(Number)
  const [h, min] = zeit.split(':').map(Number)
  const utcGuess = Date.UTC(y, m - 1, d, h, min)
  const offset = berlinOffsetMs(new Date(utcGuess))
  let t = utcGuess - offset
  const offset2 = berlinOffsetMs(new Date(t))
  if (offset2 !== offset) t = utcGuess - offset2
  return new Date(t)
}

/** Date → 'YYYY-MM-DD' in Berliner Ortszeit */
export function datumBerlin(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

/** Date → 'HH:mm' in Berliner Ortszeit */
export function zeitBerlin(date: Date): string {
  return new Intl.DateTimeFormat('de-DE', {
    timeZone: ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

export function minutenSeit(zeit: string): number {
  const [h, m] = zeit.split(':').map(Number)
  return h * 60 + m
}

export function istZeit(wert: unknown): wert is string {
  return typeof wert === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(wert)
}

/** Berliner Datum des Folgetags (YYYY-MM-DD) relativ zu `jetzt`, plus `tage` */
export function datumPlusTage(jetzt: Date, tage: number): string {
  const [y, m, d] = datumBerlin(jetzt).split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + tage))
  return t.toISOString().slice(0, 10)
}
