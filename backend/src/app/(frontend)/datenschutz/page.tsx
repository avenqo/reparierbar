import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import { Rechtstext } from '../../../components/Rechtstext'
import { ladeEinstellungen } from '../../../lib/einstellungen'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Datenschutzhinweise' }

export default async function Seite() {
  const payload = await getPayload({ config })
  const e = await ladeEinstellungen({ payload } as never)
  if (e.datenschutzUrl) redirect(e.datenschutzUrl)
  return <Rechtstext titel="Datenschutzhinweise" text={e.datenschutz} />
}
