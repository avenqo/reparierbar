import type { ServerProps } from 'payload'
import { ladeEinstellungen } from '../lib/einstellungen'
import { Marke } from './Marke'

/** Admin-Panel: Name und Farben der Instanz aus den Einstellungen (Server-Komponente). */
export async function Logo({ payload }: ServerProps) {
  const req = { payload } as never
  const e = await ladeEinstellungen(req)
  return (
    <>
      <style>{`:root{--rc-primary:${e.farbePrimaer};--rc-akzent:${e.farbeAkzent};--rc-text:${e.farbeText};}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', color: 'var(--rc-primary)', fontWeight: 700, fontSize: '1.25rem' }}>
        {e.logoUrl ? <img src={e.logoUrl} alt="" style={{ height: 36 }} /> : <Marke primaer={e.farbePrimaer} akzent={e.farbeAkzent} groesse={36} />}
        <span>{e.name}</span>
      </div>
    </>
  )
}
