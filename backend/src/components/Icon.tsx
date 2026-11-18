import type { ServerProps } from 'payload'
import { ladeEinstellungen } from '../lib/einstellungen'
import { Marke } from './Marke'

export async function Icon({ payload }: ServerProps) {
  const e = await ladeEinstellungen({ payload } as never)
  return e.logoUrl ? <img src={e.logoUrl} alt="" style={{ height: 24 }} /> : <Marke primaer={e.farbePrimaer} akzent={e.farbeAkzent} groesse={24} />
}
