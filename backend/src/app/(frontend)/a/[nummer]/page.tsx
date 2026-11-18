/**
 * Platzhalter für persönliche Links (https://…/a/RC-2026-0042#t=<schluessel>).
 * Das Web-Frontend (web/) übernimmt diese Route; auf dem Handy kann ein App Link die App öffnen.
 * Der Schlüssel steht im Fragment und erreicht den Server nie.
 */
export default async function PersoenlicherLink({ params }: { params: Promise<{ nummer: string }> }) {
  const { nummer } = await params
  return (
    <main>
      <h1>Anfrage {nummer}</h1>
      <p>Persönliche Links werden vom Web-Frontend (Unterprojekt web/) oder von der App geöffnet.</p>
    </main>
  )
}
