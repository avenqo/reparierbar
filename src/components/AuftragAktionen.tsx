'use client'

import { useDocumentInfo, useFormFields } from '@payloadcms/ui'
import React, { useState } from 'react'

const ERGEBNISSE = [
  ['REPARIERT', 'Repariert'],
  ['TEILWEISE', 'Teilweise repariert'],
  ['NICHT_REPARIERBAR', 'Nicht reparierbar'],
  ['NICHT_ERSCHIENEN', 'Nicht erschienen'],
] as const

/** Knöpfe für die Statuswechsel im Admin-Panel; rufen die Fach-Endpunkte auf. */
export const AuftragAktionen: React.FC = () => {
  const { id } = useDocumentInfo()
  const status = useFormFields(([fields]) => fields.status?.value as string | undefined)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [zeit, setZeit] = useState('10:00')
  const [grund, setGrund] = useState('')
  const [ergebnis, setErgebnis] = useState<string>('REPARIERT')
  const [laeuft, setLaeuft] = useState(false)

  if (!id) return null

  async function aufrufen(pfad: string, body: Record<string, unknown> = {}) {
    setLaeuft(true)
    setMeldung(null)
    try {
      const res = await fetch(`/api/auftraege/${id}/${pfad}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const daten = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMeldung(daten?.errors?.[0]?.message ?? `Fehler ${res.status}`)
        return
      }
      if (daten?.warnungen?.length) {
        setMeldung(`Gespeichert. Hinweis: ${daten.warnungen.join(' ')}`)
        setTimeout(() => window.location.reload(), 2500)
      } else {
        window.location.reload()
      }
    } finally {
      setLaeuft(false)
    }
  }

  const knopf = (text: string, pfad: string, body?: Record<string, unknown>) => (
    <button type="button" className="btn btn--style-primary btn--size-small" disabled={laeuft} onClick={() => aufrufen(pfad, body)}>
      {text}
    </button>
  )

  return (
    <div style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid var(--theme-elevation-150)', borderRadius: 4 }}>
      <strong>Aktionen</strong>
      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', margin: '.75rem 0' }}>
        {status === 'EINGEGANGEN' && knopf('Bestätigen', 'bestaetigen')}
        {status === 'EINGEGANGEN' && knopf('Ohne Termin übernehmen', 'uebernehmen')}
        {status === 'BESTAETIGT' && knopf('Vertretung übernehmen', 'uebernehmen')}
        {['UEBERNOMMEN', 'GEGENVORSCHLAG', 'BESTAETIGT'].includes(status ?? '') && knopf('Verantwortung abgeben', 'abgeben')}
        {['EINGEGANGEN', 'UEBERNOMMEN', 'GEGENVORSCHLAG', 'BESTAETIGT'].includes(status ?? '') && knopf('Stornieren', 'stornieren', { grund: grund || undefined })}
      </div>
      {['EINGEGANGEN', 'BESTAETIGT'].includes(status ?? '') && (
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap', margin: '.5rem 0' }}>
          <input type="time" step={900} value={zeit} onChange={(e) => setZeit(e.target.value)} />
          <input type="text" placeholder="Grund (nur bei Terminänderung)" value={grund} onChange={(e) => setGrund(e.target.value)} />
          {status === 'EINGEGANGEN' && knopf('Gegenvorschlag', 'gegenvorschlag', { ankunft: zeit })}
          {status === 'BESTAETIGT' && knopf('Termin ändern', 'termin', { ankunft: zeit, grund })}
        </div>
      )}
      {['UEBERNOMMEN', 'BESTAETIGT'].includes(status ?? '') && (
        <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', margin: '.5rem 0' }}>
          <select value={ergebnis} onChange={(e) => setErgebnis(e.target.value)}>
            {ERGEBNISSE.map(([wert, text]) => (
              <option key={wert} value={wert}>
                {text}
              </option>
            ))}
          </select>
          {knopf('Abschließen', 'abschliessen', { ergebnis })}
        </div>
      )}
      {meldung && <p style={{ color: 'var(--theme-error-500)' }}>{meldung}</p>}
    </div>
  )
}
