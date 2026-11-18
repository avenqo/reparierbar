import type { GlobalConfig } from 'payload'
import { alle, nurAdmin } from '../access'
import { STANDARD } from '../lib/einstellungen'

const hex = (v: unknown) => !v || /^#[0-9a-fA-F]{6}$/.test(String(v)) || 'Farbe als Hex-Wert, z. B. #1e6f5c'
const zeit = (v: unknown) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v)) || 'Format HH:mm'

/**
 * Instanz-Einstellungen: Name, Corporate Identity, Standardwerte.
 * Öffentlich lesbar (GET /api/globals/einstellungen) – Web-Frontends und die App holen sich Name und Farben von hier.
 */
export const Einstellungen: GlobalConfig = {
  slug: 'einstellungen',
  label: 'Einstellungen',
  access: { read: alle, update: nurAdmin },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Initiative',
          fields: [
            { name: 'name', type: 'text', required: true, defaultValue: STANDARD.name, label: 'Name', admin: { description: 'Erscheint in Mails, Kalendereinträgen und Frontends, z. B. „Repair Café Kremmen“.' } },
            { name: 'nummernPraefix', type: 'text', required: true, defaultValue: STANDARD.nummernPraefix, maxLength: 6, label: 'Präfix der Auftragsnummer', admin: { description: 'Nummern sehen aus wie RC-2026-0042. Nur Großbuchstaben und Ziffern.' }, validate: (v: unknown) => /^[A-Z0-9]{1,6}$/.test(String(v)) || 'Nur A–Z und 0–9, höchstens 6 Zeichen' },
            { name: 'kontaktEmail', type: 'email', label: 'Kontakt-E-Mail (öffentlich)' },
            { name: 'webseiteUrl', type: 'text', label: 'Webseite' },
            { name: 'impressumUrl', type: 'text', label: 'Impressum (URL)' },
            { name: 'datenschutzUrl', type: 'text', label: 'Datenschutzhinweise (URL)' },
          ],
        },
        {
          label: 'Erscheinungsbild',
          fields: [
            { name: 'farbePrimaer', type: 'text', defaultValue: STANDARD.farbePrimaer, label: 'Primärfarbe', validate: hex },
            { name: 'farbeAkzent', type: 'text', defaultValue: STANDARD.farbeAkzent, label: 'Akzentfarbe', validate: hex },
            { name: 'farbeText', type: 'text', defaultValue: STANDARD.farbeText, label: 'Textfarbe', validate: hex },
            { name: 'logoUrl', type: 'text', label: 'Logo (URL)', admin: { description: 'Öffentlich erreichbare Bilddatei (SVG oder PNG).' } },
          ],
        },
        {
          label: 'Veranstaltungen',
          fields: [
            { name: 'standardBeginn', type: 'text', defaultValue: STANDARD.standardBeginn, label: 'Beginn (Vorgabe)', validate: zeit },
            { name: 'standardEnde', type: 'text', defaultValue: STANDARD.standardEnde, label: 'Ende (Vorgabe)', validate: zeit },
            { name: 'standardLetzteAnkunft', type: 'text', defaultValue: STANDARD.standardLetzteAnkunft, label: 'Letzte Ankunft (Vorgabe)', validate: zeit },
            { name: 'standardRaster', type: 'number', defaultValue: STANDARD.standardRaster, min: 5, max: 60, label: 'Raster der Ankunftszeiten (Minuten)' },
            { name: 'standardDauerMinuten', type: 'number', defaultValue: STANDARD.standardDauerMinuten, min: 15, label: 'Dauer je Reparatur (Minuten)' },
          ],
        },
        {
          label: 'Datenschutz',
          fields: [
            { name: 'loeschfristMonate', type: 'number', defaultValue: STANDARD.loeschfristMonate, min: 1, max: 60, label: 'Löschfrist für Kontaktdaten und Bilder (Monate nach dem Termin)' },
          ],
        },
      ],
    },
  ],
}
