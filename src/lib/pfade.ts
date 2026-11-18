import path from 'node:path'

/** Absoluter Ablageort der Bilddateien (Docker-Volume `rc-bilder`). */
export function bilderVerzeichnis(): string {
  return path.resolve(process.env.BILDER_DIR || path.join(process.cwd(), 'media', 'bilder'))
}
