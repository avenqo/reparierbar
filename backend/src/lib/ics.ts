function utc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function esc(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

export function erzeugeIcs(opts: {
  nummer: string
  beginn: Date
  dauerMinuten: number
  ort?: string
  zusammenfassung: string
  beschreibung?: string
  abgesagt?: boolean
  domain: string
}): string {
  const ende = new Date(opts.beginn.getTime() + opts.dauerMinuten * 60_000)
  const sequenz = Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 1000)
  const zeilen = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ReparierBar//DE',
    `METHOD:${opts.abgesagt ? 'CANCEL' : 'PUBLISH'}`,
    'BEGIN:VEVENT',
    `UID:${opts.nummer}@${opts.domain}`,
    `DTSTAMP:${utc(new Date())}`,
    `SEQUENCE:${sequenz}`,
    `DTSTART:${utc(opts.beginn)}`,
    `DTEND:${utc(ende)}`,
    `SUMMARY:${esc(opts.zusammenfassung)}`,
    ...(opts.ort ? [`LOCATION:${esc(opts.ort)}`] : []),
    ...(opts.beschreibung ? [`DESCRIPTION:${esc(opts.beschreibung)}`] : []),
    `STATUS:${opts.abgesagt ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return zeilen.join('\r\n') + '\r\n'
}
