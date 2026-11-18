import { APIError, type CollectionConfig } from 'payload'
import { istAdmin, nurReparista, relId } from '../access'
import { bilderVerzeichnis } from '../lib/pfade'

export const MAX_BILDER = 3

export const Bilder: CollectionConfig = {
  slug: 'bilder',
  labels: { singular: 'Bild', plural: 'Bilder' },
  admin: { defaultColumns: ['filename', 'auftrag', 'reihenfolge'], useAsTitle: 'filename' },
  access: {
    // Dateien werden nur ausgeliefert, wenn dieses Lese-Recht greift (Reparistas, Admins).
    // Gäste bekommen ihre Bilder über /api/gast/auftrag/bilder/:id.
    read: nurReparista,
    create: nurReparista,
    update: nurReparista,
    delete: ({ req }) => istAdmin(req.user),
  },
  upload: {
    staticDir: bilderVerzeichnis(),
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    resizeOptions: { width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true },
    formatOptions: { format: 'jpeg', options: { quality: 80 } },
    imageSizes: [{ name: 'vorschau', width: 400, formatOptions: { format: 'jpeg', options: { quality: 75 } } }],
    adminThumbnail: 'vorschau',
    withMetadata: false, // entfernt EXIF inkl. GPS
  },
  hooks: {
    beforeValidate: [
      async ({ data, operation, req }) => {
        if (operation !== 'create' || !data) return data
        const auftragId = relId(data.auftrag)
        if (auftragId === null) throw new APIError('Bild braucht einen Auftrag.', 400, undefined, true)
        const vorhanden = await req.payload.count({
          collection: 'bilder',
          where: { auftrag: { equals: auftragId } },
          req,
          overrideAccess: true,
        })
        if (vorhanden.totalDocs >= MAX_BILDER) {
          throw new APIError(`Je Auftrag sind höchstens ${MAX_BILDER} Bilder erlaubt.`, 422, undefined, true)
        }
        data.reihenfolge = data.reihenfolge ?? vorhanden.totalDocs + 1
        return data
      },
    ],
  },
  fields: [
    { name: 'auftrag', type: 'relationship', relationTo: 'auftraege', required: true, index: true, label: 'Auftrag' },
    { name: 'reihenfolge', type: 'number', label: 'Reihenfolge' },
  ],
}

