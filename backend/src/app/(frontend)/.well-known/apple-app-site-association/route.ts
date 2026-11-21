/** iOS Universal Links: IOS_APP_ID setzen (TEAMID.bundle.id). Die persönlichen Links liegen unter /a/*. */
export const dynamic = 'force-dynamic'

export function GET() {
  const appId = process.env.IOS_APP_ID
  if (!appId) return new Response('Not found', { status: 404 })
  return Response.json({ applinks: { details: [{ appIDs: [appId], components: [{ '/': '/a/*' }] }] } })
}
