import { describe, expect, it } from 'vitest'
import { pruefeAnkunft, TerminFehler, ueberschneidet, type VeranstaltungsZeiten } from '../src/lib/termin'

const v: VeranstaltungsZeiten = { datum: '2026-11-21', beginn: '10:00', ende: '14:00', letzteAnkunft: '13:00', rasterMinuten: 15 }

describe('pruefeAnkunft', () => {
  it('akzeptiert Zeiten im Raster zwischen Beginn und letzter Ankunft', () => {
    expect(pruefeAnkunft(v, '10:00').toISOString()).toBe('2026-11-21T09:00:00.000Z')
    expect(pruefeAnkunft(v, '13:00').toISOString()).toBe('2026-11-21T12:00:00.000Z')
  })
  it('lehnt zu späte und zu frühe Ankunft ab', () => {
    expect(() => pruefeAnkunft(v, '13:15')).toThrow(TerminFehler)
    expect(() => pruefeAnkunft(v, '09:45')).toThrow(TerminFehler)
  })
  it('lehnt Zeiten außerhalb des Rasters und ungültige Formate ab', () => {
    expect(() => pruefeAnkunft(v, '10:10')).toThrow(TerminFehler)
    expect(() => pruefeAnkunft(v, '25:00')).toThrow(TerminFehler)
    expect(() => pruefeAnkunft(v, 1000)).toThrow(TerminFehler)
  })
})

describe('ueberschneidet', () => {
  const a = new Date('2026-11-21T09:00:00Z')
  it('warnt bei weniger als der Dauer Abstand', () => {
    expect(ueberschneidet(a, new Date('2026-11-21T09:30:00Z'), 60)).toBe(true)
  })
  it('warnt nicht bei genau einer Stunde Abstand', () => {
    expect(ueberschneidet(a, new Date('2026-11-21T10:00:00Z'), 60)).toBe(false)
  })
})
