import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** Persönlicher Link-Schlüssel: 256 Bit Zufall, URL-sicher. */
export function neuerSchluessel(): string {
  return randomBytes(32).toString('base64url')
}

export function hashSchluessel(schluessel: string): string {
  return createHash('sha256').update(schluessel).digest('hex')
}

export function hashEmail(email: string): string {
  return createHash('sha256').update(email.trim().toLowerCase()).digest('hex')
}

function geheimnis(): string {
  const s = process.env.PAYLOAD_SECRET
  if (!s) throw new Error('PAYLOAD_SECRET fehlt')
  return s
}

/**
 * Aktions-Token für Links in Mails („Das war ich nicht“, Gegenvorschlag annehmen/ablehnen).
 * Wird aus PAYLOAD_SECRET abgeleitet und deshalb nicht gespeichert. Der Zweck enthält bei
 * Gegenvorschlägen die vorgeschlagene Zeit, damit alte Links ungültig werden.
 */
export function aktionsToken(zweck: string, auftragId: number | string): string {
  return createHmac('sha256', geheimnis()).update(`${zweck}:${auftragId}`).digest('base64url')
}

export function pruefeAktionsToken(token: unknown, zweck: string, auftragId: number | string): boolean {
  if (typeof token !== 'string' || token.length === 0) return false
  const erwartet = Buffer.from(aktionsToken(zweck, auftragId))
  const gegeben = Buffer.from(token)
  return erwartet.length === gegeben.length && timingSafeEqual(erwartet, gegeben)
}
