import type { CollectionConfig } from 'payload'
import { alle, nurAdmin } from '../access'
import { ladeEinstellungen } from '../lib/einstellungen'
import { belegungEndpoint, tageslisteEndpoint } from '../endpoints/veranstaltungen'

const zeitFeld = /^([01]\d|2[0-3]):[0-5]\d$/

export const Veranstaltungen: CollectionConfig = {
  slug: 'veranstaltungen',
  labels: { singular: 'Veranstaltung', plural: 'Veranstaltungen' },
  admin: { useAsTitle: 'datum', defaultColumns: ['datum', 'ort', 'status', 'anmeldeschluss'] },
  defaultSort: 'datum',
  access: { read: alle, create: nurAdmin, update: nurAdmin, delete: nurAdmin },
  endpoints: [belegungEndpoint, tageslisteEndpoint],
  fields: [
    {
      name: 'datum',
      type: 'date',
      required: true,
      label: 'Datum',
      admin: { date: { pickerAppearance: 'dayOnly', displayFormat: 'dd.MM.yyyy' } },
    },
    {
      type: 'row',
      fields: [
        { name: 'beginn', type: 'text', required: true, defaultValue: async ({ req }: { req: never }) => (await ladeEinstellungen(req)).standardBeginn, label: 'Beginn (HH:mm)', validate: (v: unknown) => zeitFeld.test(String(v)) || 'Format HH:mm' },
        { name: 'ende', type: 'text', required: true, defaultValue: async ({ req }: { req: never }) => (await ladeEinstellungen(req)).standardEnde, label: 'Ende (HH:mm)', validate: (v: unknown) => zeitFeld.test(String(v)) || 'Format HH:mm' },
        { name: 'letzteAnkunft', type: 'text', required: true, defaultValue: async ({ req }: { req: never }) => (await ladeEinstellungen(req)).standardLetzteAnkunft, label: 'Letzte Ankunft (HH:mm)', validate: (v: unknown) => zeitFeld.test(String(v)) || 'Format HH:mm' },
        { name: 'rasterMinuten', type: 'number', required: true, defaultValue: async ({ req }: { req: never }) => (await ladeEinstellungen(req)).standardRaster, min: 5, max: 60, label: 'Raster (Minuten)' },
      ],
    },
    { name: 'ort', type: 'text', required: true, label: 'Ort' },
    {
      name: 'anmeldeschluss',
      type: 'date',
      label: 'Anmeldeschluss (optional)',
      admin: { date: { pickerAppearance: 'dayAndTime' } },
    },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'GEPLANT',
      label: 'Status',
      options: [
        { label: 'Geplant', value: 'GEPLANT' },
        { label: 'Abgesagt', value: 'ABGESAGT' },
        { label: 'Abgeschlossen', value: 'ABGESCHLOSSEN' },
      ],
    },
  ],
}
