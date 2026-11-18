import type { PayloadRequest } from 'payload'
import { istAdmin, istReparista } from '../access'
import { fehler } from './fehler'

export function braucheReparista(req: PayloadRequest) {
  if (!req.user) throw fehler(401, 'Bitte anmelden.')
  if (!istReparista(req.user)) throw fehler(403, 'Dafür fehlt die Berechtigung.')
  return req.user as typeof req.user & { id: number; rolle?: string }
}

export function braucheAdmin(req: PayloadRequest) {
  const user = braucheReparista(req)
  if (!istAdmin(user)) throw fehler(403, 'Nur für Admins.')
  return user
}
