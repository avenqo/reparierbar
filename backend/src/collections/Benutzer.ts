import { APIError, type CollectionConfig } from 'payload'
import { istAdmin, istReparista, nurAdmin } from '../access'

export const Benutzer: CollectionConfig = {
  slug: 'benutzer',
  labels: { singular: 'Benutzer', plural: 'Benutzer' },
  auth: {
    tokenExpiration: 60 * 60 * 12,
    maxLoginAttempts: 5,
    lockTime: 10 * 60 * 1000,
    // Secure-Cookie nur über HTTPS, sonst verwirft der Browser es (z. B. bei http://localhost)
    cookies: { sameSite: 'Lax', secure: (process.env.PUBLIC_URL || '').startsWith('https://') },
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
    beforeChange: [
      async ({ data, operation, req }) => {
        // Der erste angelegte Benutzer (first-register) wird Admin; danach vergeben nur Admins Rollen.
        if (operation === 'create') {
          const vorhanden = await req.payload.count({ collection: 'benutzer', req, overrideAccess: true })
          if (vorhanden.totalDocs === 0) {
            data.rolle = 'ADMIN'
            data.aktiv = true // das Formular schickt sonst ein ungehaktes „Aktiv“ als false mit
          }
        }
        return data
      },
    ],
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
      // Bei der ersten Registrierung (noch niemand angemeldet) ausgeblendet: der erste Benutzer wird automatisch Admin.
      admin: { condition: (_data, _sibling, { user }) => Boolean(user), description: 'Admins dürfen zusätzlich Veranstaltungen, Benutzer und Einstellungen verwalten.' },
    },
    {
      name: 'aktiv',
      type: 'checkbox',
      defaultValue: true,
      label: 'Aktiv',
      admin: { condition: (_data, _sibling, { user }) => Boolean(user) },
      access: { create: ({ req }) => istAdmin(req.user), update: ({ req }) => istAdmin(req.user) },
    },
    {
      name: 'fachgebiete',
      type: 'text',
      hasMany: true,
      label: 'Fachgebiete (optional)',
      admin: {
        description: 'Freitext, keine feste Liste: Begriff eintippen und mit Enter bestätigen, z. B. „Elektrogeräte“, „Fahrrad“, „Textil“. Kann leer bleiben.',
        condition: (_data, _sibling, { user }) => Boolean(user),
      },
    },
  ],
}
