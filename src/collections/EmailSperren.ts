import type { CollectionConfig } from 'payload'
import { niemand, nurAdmin } from '../access'

/** Gesperrte Adressen nach „Das war ich nicht“. Nur der Hash wird gespeichert. */
export const EmailSperren: CollectionConfig = {
  slug: 'email-sperren',
  labels: { singular: 'E-Mail-Sperre', plural: 'E-Mail-Sperren' },
  admin: { useAsTitle: 'emailHash', defaultColumns: ['emailHash', 'gesperrtAm'] },
  access: { read: nurAdmin, create: niemand, update: niemand, delete: nurAdmin },
  fields: [
    { name: 'emailHash', type: 'text', required: true, unique: true, index: true, label: 'E-Mail (SHA-256)' },
    { name: 'gesperrtAm', type: 'date', required: true, defaultValue: () => new Date().toISOString(), label: 'Gesperrt am' },
  ],
}
