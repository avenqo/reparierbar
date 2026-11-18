import type { ServerProps } from 'payload'
import { ladeEinstellungen } from '../lib/einstellungen'

export async function Icon({ payload }: ServerProps) {
  const e = await ladeEinstellungen({ payload } as never)
  return e.logoUrl ? (
    <img src={e.logoUrl} alt="" style={{ height: 24 }} />
  ) : (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill={e.farbePrimaer} />
      <path d="M7 15l3-6 2 4 2-3 3 5" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
