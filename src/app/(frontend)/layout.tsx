import React from 'react'

export const metadata = {
  title: 'ReparierBar – Repair Café Kremmen',
  description: 'Terminanmeldung für das Repair Café Kremmen',
}

export default function FrontendLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 40 * 16, margin: '3rem auto', padding: '0 1rem' }}>{children}</body>
    </html>
  )
}
