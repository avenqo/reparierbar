import type { CollectionConfig } from 'payload'
import { niemand, nurReparista } from '../access'

/** Historie eines Auftrags. Über die API nur lesbar; geschrieben wird ausschließlich im Code. */
export const Ereignisse: CollectionConfig = {
  slug: 'ereignisse',
  labels: { singular: 'Ereignis', plural: 'Ereignisse' },
  admin: { useAsTitle: 'aktion', defaultColumns: ['auftrag', 'zeitpunkt', 'akteurTyp', 'aktion'] },
  defaultSort: '-zeitpunkt',
  access: { read: nurReparista, create: niemand, update: niemand, delete: niemand },
  fields: [
    { name: 'auftrag', type: 'relationship', relationTo: 'auftraege', required: true, index: true, label: 'Auftrag' },
    { name: 'zeitpunkt', type: 'date', required: true, defaultValue: () => new Date().toISOString(), label: 'Zeitpunkt', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    {
      name: 'akteurTyp',
      type: 'select',
      required: true,
      label: 'Akteur',
      options: [
        { label: 'Gast', value: 'GAST' },
        { label: 'Benutzer', value: 'BENUTZER' },
        { label: 'System', value: 'SYSTEM' },
      ],
    },
    { name: 'akteur', type: 'relationship', relationTo: 'benutzer', label: 'Benutzer' },
    { name: 'aktion', type: 'text', required: true, label: 'Aktion' },
    { name: 'vorher', type: 'json', label: 'Vorher' },
    { name: 'nachher', type: 'json', label: 'Nachher' },
  ],
}
