import { Marked } from 'marked'

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Markdown → HTML für Impressum und Datenschutz. Rohes HTML wird maskiert, nur sichere Link-Ziele zugelassen. */
const marked = new Marked({
  gfm: true,
  renderer: {
    html: ({ text }) => esc(text),
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens)
      const ok = /^(https?:|mailto:|tel:|\/|#)/i.test(href)
      return ok ? `<a href="${esc(href)}"${title ? ` title="${esc(title)}"` : ''} rel="noopener">${text}</a>` : text
    },
    image: ({ text }) => esc(text),
  },
})

export function markdownZuHtml(text: string): string {
  return marked.parse(text, { async: false }) as string
}
