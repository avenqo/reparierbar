import { APIError, type CollectionConfig } from 'payload'
import { istAdmin, istReparista, nurAdmin } from '../access'

export const Benutzer: CollectionConfig = {
  slug: 'benutzer',
  labels: { singular: 'Benutzer', plural: 'Benutzer' },
  auth: {
    tokenExpiration: 60 * 60 * 12,
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
    cookies: { sameSite: 'Lax', secure: process.env.NODE_ENV === 'production' },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'rolle', 'aktiv'],
  },
  access: {
    admin: ({ req }) => istReparista(req.user),
    read: ({ req }) => istReparista(req.user),
    create: nurAdmin,
    update: ({ req }) => {
      if (istAdmin(req.user)) return true
      // Reparistas dürfen nur ihr eigenes Konto ändern (Rolle/aktiv sind per Feldrecht gesperrt)
      return istReparista(req.user) && req.user ? { id: { equals: req.user.id } } : false
    },
    delete: nurAdmin,
  },
  hooks: {
    beforeLogin: [
      ({ user }) => {
        if ((user as { aktiv?: boolean }).aktiv === false) {
          throw new APIError('Dieses Konto ist deaktiviert.', 403, undefined, true)
        }
      },
    ],
  },
  fields: [
    { name: 'name', type: 'text', required: true, label: 'Name' },
    {
      name: 'rolle',
      type: 'select',
      required: true,
      defaultValue: 'REPARISTA',
      label: 'Rolle',
      options: [
        { label: 'Reparista', value: 'REPARISTA' },
        { label: 'Admin', value: 'ADMIN' },
      ],
      access: { create: ({ req }) => istAdmin(req.user), update: ({ req }) => istAdmin(req.user) },
    },
    {
      name: 'aktiv',
      type: 'checkbox',
      defaultValue: true,
      label: 'Aktiv',
      access: { create: ({ req }) => istAdmin(req.user), update: ({ req }) => istAdmin(req.user) },
    },
    { name: 'fachgebiete', type: 'text', hasMany: true, label: 'Fachgebiete' },
  ],
}
