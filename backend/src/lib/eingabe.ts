import type { PayloadRequest } from 'payload'
import { fehler } from './fehler'

export async function lies(req: PayloadRequest): Promise<Record<string, unknown>> {
  try {
    const body = await req.json?.()
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export function textFeld(wert: unknown, name: string, max: number, pflicht = false): string | undefined {
  if (wert === undefined || wert === null || wert === '') {
    if (pflicht) throw fehler(400, `${name} fehlt.`)
    return undefined
  }
  if (typeof wert !== 'string') throw fehler(400, `${name} ist ungültig.`)
  const t = wert.trim()
  if (!t) {
    if (pflicht) throw fehler(400, `${name} fehlt.`)
    return undefined
  }
  if (t.length > max) throw fehler(422, `${name} ist zu lang (höchstens ${max} Zeichen).`)
  return t
}

export function emailFeld(wert: unknown): string | undefined {
  const t = textFeld(wert, 'E-Mail', 200)
  if (t && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) throw fehler(422, 'Die E-Mail-Adresse ist ungültig.')
  return t?.toLowerCase()
}

export function idFeld(wert: unknown, name: string): number {
  const n = Number(wert)
  if (!Number.isInteger(n) || n <= 0) throw fehler(400, `${name} fehlt oder ist ungültig.`)
  return n
}

export function routenId(req: PayloadRequest, name = 'id'): number {
  return idFeld(req.routeParams?.[name], name)
}

export const jsonAntwort = (daten: unknown, status = 200) => Response.json(daten, { status })
