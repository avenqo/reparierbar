import { describe, expect, it } from 'vitest'
import { berlinZuDate, datumBerlin, datumPlusTage, zeitBerlin } from '../src/lib/zeit'

describe('zeit', () => {
  it('rechnet Winterzeit (UTC+1) um', () => {
    expect(berlinZuDate('2026-11-21', '10:00').toISOString()).toBe('2026-11-21T09:00:00.000Z')
  })
  it('rechnet Sommerzeit (UTC+2) um', () => {
    expect(berlinZuDate('2026-07-18', '10:00').toISOString()).toBe('2026-07-18T08:00:00.000Z')
  })
  it('kommt über Datum/Zeit-Rückweg zum selben Wert', () => {
    const d = berlinZuDate('2026-03-28', '13:15')
    expect(datumBerlin(d)).toBe('2026-03-28')
    expect(zeitBerlin(d)).toBe('13:15')
  })
  it('liefert Datum plus Tage', () => {
    expect(datumPlusTage(new Date('2026-11-20T12:00:00Z'), 1)).toBe('2026-11-21')
    expect(datumPlusTage(new Date('2026-12-30T12:00:00Z'), 3)).toBe('2027-01-02')
  })
})
