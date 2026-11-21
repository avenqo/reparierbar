import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { Rechtstext } from '../../../components/Rechtstext'
import { ladeEinstellungen } from '../../../lib/einstellungen'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Impressum' }

export default async function Seite() {
  const payload = await getPayload({ config })
  const e = await ladeEinstellungen({ payload } as never)
  if (e.impressumUrl) redirect(e.impressumUrl)
  return <Rechtstext titel="Impressum" text={e.impressum} />
}
