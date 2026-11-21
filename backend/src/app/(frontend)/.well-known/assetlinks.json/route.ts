/** Android App Links: ANDROID_PACKAGE und ANDROID_SHA256 (kommagetrennte Zertifikat-Fingerabdrücke) setzen. */
export const dynamic = 'force-dynamic'

export function GET() {
  const pkg = process.env.ANDROID_PACKAGE
  const fingerprints = (process.env.ANDROID_SHA256 || '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!pkg || !fingerprints.length) return new Response('Not found', { status: 404 })
  return Response.json([
    { relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: pkg, sha256_cert_fingerprints: fingerprints } },
  ])
}
