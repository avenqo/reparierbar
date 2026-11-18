/** Bildmarke (Schraubenschlüssel mit Funke) in den Farben der Instanz. Vorlage: public/logo.svg */
export function Marke({ primaer, akzent, groesse = 32 }: { primaer: string; akzent: string; groesse?: number }) {
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 48 48" role="img" aria-label="Logo">
      <rect width="48" height="48" rx="11" fill={primaer} />
      <g transform="rotate(45 24 24)">
        <circle cx="24" cy="14" r="9" fill="#fff" />
        <rect x="20.5" y="20" width="7" height="19" rx="3.5" fill="#fff" />
        <rect x="20.5" y="3" width="7" height="11" fill={primaer} />
      </g>
      <path d="M36 28.5l1.5 4.5 4.5 1.5-4.5 1.5L36 40.5l-1.5-4.5L30 34.5l4.5-1.5z" fill={akzent} />
    </svg>
  )
}
