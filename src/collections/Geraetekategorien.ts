import type { CollectionConfig } from 'payload'
import { alle, nurAdmin } from '../access'

export const Geraetekategorien: CollectionConfig = {
  slug: 'geraetekategorien',
  labels: { singular: 'Gerätekategorie', plural: 'Gerätekategorien' },
  admin: { useAsTitle: 'name', defaultColumns: ['name', 'reihenfolge'] },
  defaultSort: 'reihenfolge',
  access: { read: alle, create: nurAdmin, update: nurAdmin, delete: nurAdmin },
  fields: [
    { name: 'name', type: 'text', required: true, unique: true, label: 'Name' },
    { name: 'reihenfolge', type: 'number', defaultValue: 100, label: 'Reihenfolge' },
  ],
}
