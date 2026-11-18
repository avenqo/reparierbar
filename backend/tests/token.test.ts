import { describe, expect, it } from 'vitest'
import { aktionsToken, hashEmail, hashSchluessel, neuerSchluessel, pruefeAktionsToken } from '../src/lib/token'

describe('token', () => {
  it('erzeugt 256-Bit-Schlüssel und speichert nur den Hash', () => {
    const s = neuerSchluessel()
    expect(Buffer.from(s, 'base64url')).toHaveLength(32)
    expect(hashSchluessel(s)).toMatch(/^[0-9a-f]{64}$/)
    expect(hashSchluessel(s)).not.toContain(s)
  })
  it('normalisiert E-Mail-Adressen für die Sperrliste', () => {
    expect(hashEmail(' Max@Example.org ')).toBe(hashEmail('max@example.org'))
  })
  it('prüft Aktions-Tokens je Zweck und Auftrag', () => {
    const t = aktionsToken('nicht-ich', 42)
    expect(pruefeAktionsToken(t, 'nicht-ich', 42)).toBe(true)
    expect(pruefeAktionsToken(t, 'nicht-ich', 43)).toBe(false)
    expect(pruefeAktionsToken(t, 'vorschlag:x', 42)).toBe(false)
    expect(pruefeAktionsToken(undefined, 'nicht-ich', 42)).toBe(false)
  })
})
