import { markdownZuHtml } from '../lib/markdown'

export function Rechtstext({ titel, text }: { titel: string; text: string | null }) {
  return (
    <main>
      <h1>{titel}</h1>
      {text ? <div dangerouslySetInnerHTML={{ __html: markdownZuHtml(text) }} /> : <p>Dieser Text ist noch nicht hinterlegt.</p>}
    </main>
  )
}
