import type { CollectionConfig } from 'payload'
import { istAdmin, nurReparista, relId } from '../access'

export const Notizen: CollectionConfig = {
  slug: 'notizen',
  labels: { singular: 'Notiz', plural: 'Notizen' },
  admin: { useAsTitle: 'text', defaultColumns: ['auftrag', 'autor', 'text', 'createdAt'] },
  access: {
    read: nurReparista,
    create: nurReparista,
    update: ({ req }) => {
      if (istAdmin(req.user)) return true
      return req.user ? { autor: { equals: req.user.id } } : false
    },
    delete: ({ req }) => {
      if (istAdmin(req.user)) return true
      return req.user ? { autor: { equals: req.user.id } } : false
    },
  },
  hooks: {
    beforeChange: [
      ({ data, operation, req }) => {
        if (operation === 'create' && req.user) data.autor = relId(req.user)
        return data
      },
    ],
  },
  fields: [
    { name: 'auftrag', type: 'relationship', relationTo: 'auftraege', required: true, index: true, label: 'Auftrag' },
    { name: 'autor', type: 'relationship', relationTo: 'benutzer', label: 'Autor', admin: { readOnly: true } },
    { name: 'text', type: 'textarea', required: true, maxLength: 4000, label: 'Notiz' },
    {
      name: 'link',
      type: 'text',
      label: 'Link (Anleitung, Video …)',
      validate: (v: unknown) => {
        if (!v) return true
        try {
          const u = new URL(String(v))
          return u.protocol === 'https:' || u.protocol === 'http:' || 'Nur http(s)-Links erlaubt'
        } catch {
          return 'Ungültiger Link'
        }
      },
    },
  ],
}
