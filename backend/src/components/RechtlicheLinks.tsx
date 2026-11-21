import type { ServerProps } from 'payload'
import { ladeEinstellungen } from '../lib/einstellungen'

/**
 * Admin-Panel: Links zu Impressum und Datenschutzhinweisen (Anmeldeseite und Navigation).
 * Angemeldete Benutzer sehen zusätzlich einen Hinweis, solange die Texte fehlen.
 */
export async function RechtlicheLinks({ payload, user }: ServerProps) {
  const e = await ladeEinstellungen({ payload } as never)
  const hatImpressum = Boolean(e.impressum || e.impressumUrl)
  const hatDatenschutz = Boolean(e.datenschutz || e.datenschutzUrl)
  const fehlt = [!hatImpressum && 'Impressum', !hatDatenschutz && 'Datenschutzhinweise'].filter(Boolean)
  return (
    <div style={{ fontSize: '.85rem', margin: '1rem 0', color: 'var(--theme-elevation-600)' }}>
      {user && fehlt.length > 0 && (
        <p style={{ padding: '.6rem .8rem', border: '1px solid var(--theme-warning-500, #d69e2e)', borderRadius: 4 }}>
          Es fehlt noch: {fehlt.join(' und ')}. Bitte unter <a href="/admin/globals/einstellungen">Einstellungen → Rechtliches</a> hinterlegen, bevor Gäste Kontaktdaten angeben.
        </p>
      )}
      <p>
        {hatImpressum && (
          <a href="/impressum" target="_blank" rel="noopener">
            Impressum
          </a>
        )}
        {hatImpressum && hatDatenschutz && ' · '}
        {hatDatenschutz && (
          <a href="/datenschutz" target="_blank" rel="noopener">
            Datenschutzhinweise
          </a>
        )}
      </p>
    </div>
  )
}
