import type { Access, FieldAccess } from 'payload'

type NutzerLike = { id?: number | string; collection?: string; rolle?: string | null; aktiv?: boolean | null } | null | undefined

/** Eingeloggter, aktiver Reparista oder Admin. Gäste haben nie einen Login. */
export function istReparista(user: NutzerLike): boolean {
  return Boolean(user && user.collection === 'benutzer' && user.aktiv !== false)
}

export function istAdmin(user: NutzerLike): boolean {
  return istReparista(user) && user?.rolle === 'ADMIN'
}

export const alle: Access = () => true
export const niemand: Access = () => false
export const nurReparista: Access = ({ req }) => istReparista(req.user)
export const nurAdmin: Access = ({ req }) => istAdmin(req.user)

export const feldNurReparista: FieldAccess = ({ req }) => istReparista(req.user)
export const feldNiemand: FieldAccess = () => false

/** ID aus einer Relation (ID oder bereits aufgelöstes Objekt) */
export function relId(wert: unknown): number | string | null {
  if (wert === null || wert === undefined) return null
  if (typeof wert === 'object') return ((wert as { id?: number | string }).id ?? null) as number | string | null
  return wert as number | string
}
