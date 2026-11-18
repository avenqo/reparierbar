/**
 * Platzhalter für persönliche Links (https://…/a/RC-2026-0042#t=<schluessel>).
 * Stufe 2 macht daraus die Gäste-Webseite; auf dem Handy öffnet ein App Link die Ortsfunk-App.
 * Der Schlüssel steht im Fragment und erreicht den Server nie.
 */
export default async function PersoenlicherLink({ params }: { params: Promise<{ nummer: string }> }) {
  const { nummer } = await params
  return (
    <main>
      <h1>Anfrage {nummer}</h1>
      <p>Bitte öffne diesen Link auf dem Handy mit der Ortsfunk-App, um deine Anfrage zu sehen. Die Webansicht folgt.</p>
    </main>
  )
}
