import type { CollectionConfig, FieldAccess } from 'payload'
import { feldNiemand, feldNurReparista, istAdmin, istReparista, relId } from '../access'
import { datumBerlin } from '../lib/zeit'
import { auftragEndpoints } from '../endpoints/auftraege'
import { ladeEinstellungen } from '../lib/einstellungen'

/** Kontaktdaten: nur der Verantwortliche und Admins. */
const kontaktLesen: FieldAccess = ({ req, doc }) => {
  const user = req.user
  if (!istReparista(user)) return false
  if (istAdmin(user)) return true
  const verantwortlich = relId((doc as { verantwortlich?: unknown } | undefined)?.verantwortlich)
  return verantwortlich !== null && String(verantwortlich) === String(user?.id)
}

/** Status und Termine ändern nur die Fach-Endpunkte (Local API mit overrideAccess). */
const nurEndpunkte = { create: feldNiemand, update: feldNiemand }

export const Auftraege: CollectionConfig = {
  slug: 'auftraege',
  labels: { singular: 'Auftrag', plural: 'Aufträge' },
  admin: {
    useAsTitle: 'nummer',
    defaultColumns: ['nummer', 'status', 'veranstaltung', 'terminAnkunft', 'geraetekategorie', 'hersteller', 'verantwortlich'],
    listSearchableFields: ['nummer', 'hersteller', 'typ'],
  },
  defaultSort: '-createdAt',
  endpoints: auftragEndpoints,
  access: {
    read: ({ req }) => istReparista(req.user),
    create: ({ req }) => istAdmin(req.user),
    update: ({ req }) => {
      if (istAdmin(req.user)) return true
      return istReparista(req.user) && req.user ? { verantwortlich: { equals: req.user.id } } : false
    },
    delete: ({ req }) => istAdmin(req.user), // der beforeDelete-Hook räumt Bilder, Notizen, Historie mit ab
  },
  hooks: {
    beforeChange: [
      async ({ data, operation, originalDoc, req }) => {
        if (operation === 'create') {
          data.status = data.status ?? 'EINGEGANGEN'
          data.dauerMinuten = data.dauerMinuten ?? (await ladeEinstellungen(req)).standardDauerMinuten
          if (!data.nummer) data.nummer = await naechsteNummer(req)
        }
        const email = data.kontakt && 'email' in data.kontakt ? data.kontakt.email : originalDoc?.kontakt?.email
        data.emailVorhanden = Boolean(email)
        return data
      },
    ],
    // beforeDelete, nicht afterDelete: die Fremdschlüssel (NOT NULL) verbieten verwaiste Dokumente.
    beforeDelete: [
      async ({ id, req }) => {
        // Payload löscht abhängige Dokumente nicht mit; Bild-Dokumente nehmen ihre Dateien mit.
        for (const collection of ['bilder', 'notizen', 'ereignisse'] as const) {
          await req.payload.delete({
            collection,
            where: { auftrag: { equals: id } },
            req,
            overrideAccess: true,
          })
        }
      },
    ],
  },
  fields: [
    { name: 'aktionen', type: 'ui', admin: { components: { Field: '/components/AuftragAktionen#AuftragAktionen' } } },
    { name: 'nummer', type: 'text', unique: true, index: true, label: 'Nummer', admin: { readOnly: true } },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'EINGEGANGEN',
      index: true,
      label: 'Status',
      access: nurEndpunkte,
      admin: { readOnly: true },
      options: [
        { label: 'Eingegangen', value: 'EINGEGANGEN' },
        { label: 'Übernommen (ohne Termin)', value: 'UEBERNOMMEN' },
        { label: 'Gegenvorschlag offen', value: 'GEGENVORSCHLAG' },
        { label: 'Termin bestätigt', value: 'BESTAETIGT' },
        { label: 'Erledigt', value: 'ERLEDIGT' },
        { label: 'Storniert', value: 'STORNIERT' },
      ],
    },
    {
      name: 'kanal',
      type: 'select',
      required: true,
      defaultValue: 'APP',
      label: 'Kanal',
      access: nurEndpunkte,
      options: [
        { label: 'App', value: 'APP' },
        { label: 'Web', value: 'WEB' },
        { label: 'Telefon', value: 'TELEFON' },
      ],
    },
    { name: 'angelegtVon', type: 'relationship', relationTo: 'benutzer', label: 'Angelegt von', access: nurEndpunkte, admin: { readOnly: true } },
    { name: 'geraetekategorie', type: 'relationship', relationTo: 'geraetekategorien', required: true, label: 'Gerätekategorie' },
    { name: 'hersteller', type: 'text', maxLength: 60, label: 'Hersteller (öffentlich sichtbar)' },
    { name: 'typ', type: 'text', maxLength: 60, label: 'Typ (öffentlich sichtbar)' },
    { name: 'fehlerbeschreibung', type: 'textarea', maxLength: 2000, label: 'Fehlerbeschreibung' },
    { name: 'veranstaltung', type: 'relationship', relationTo: 'veranstaltungen', required: true, index: true, label: 'Veranstaltung' },
    { name: 'wunschAnkunft', type: 'date', label: 'Wunsch-Ankunft', access: nurEndpunkte, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'terminAnkunft', type: 'date', label: 'Bestätigte Ankunft', access: nurEndpunkte, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'vorschlagAnkunft', type: 'date', label: 'Vorgeschlagene Ankunft', access: nurEndpunkte, admin: { readOnly: true, date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'dauerMinuten', type: 'number', min: 15, label: 'Dauer (Minuten)' },
    { name: 'verantwortlich', type: 'relationship', relationTo: 'benutzer', index: true, label: 'Verantwortlich', access: nurEndpunkte, admin: { readOnly: true } },
    { name: 'vertretungGesucht', type: 'checkbox', defaultValue: false, label: 'Vertretung gesucht', access: nurEndpunkte, admin: { readOnly: true } },
    { name: 'erinnertFuer', type: 'date', label: 'Erinnert für Termin', access: nurEndpunkte, admin: { readOnly: true, position: 'sidebar' } },
    { name: 'linkSchluesselHash', type: 'text', unique: true, index: true, hidden: true, access: { read: feldNiemand, create: feldNiemand, update: feldNiemand } },
    {
      name: 'ergebnis',
      type: 'select',
      label: 'Ergebnis',
      access: nurEndpunkte,
      admin: { readOnly: true },
      options: [
        { label: 'Repariert', value: 'REPARIERT' },
        { label: 'Teilweise repariert', value: 'TEILWEISE' },
        { label: 'Nicht reparierbar', value: 'NICHT_REPARIERBAR' },
        { label: 'Nicht erschienen', value: 'NICHT_ERSCHIENEN' },
      ],
    },
    { name: 'emailVorhanden', type: 'checkbox', defaultValue: false, label: 'E-Mail vorhanden', access: { create: feldNiemand, update: feldNiemand, read: feldNurReparista }, admin: { readOnly: true } },
    { name: 'anonymisiertAm', type: 'date', label: 'Anonymisiert am', access: nurEndpunkte, admin: { readOnly: true, position: 'sidebar' } },
    {
      name: 'kontakt',
      type: 'group',
      label: 'Kontakt (nur Verantwortlicher und Admins)',
      access: { read: kontaktLesen, create: feldNiemand, update: feldNiemand },
      fields: [
        { name: 'name', type: 'text', maxLength: 100, label: 'Name' },
        { name: 'email', type: 'email', index: true, label: 'E-Mail' },
        { name: 'telefon', type: 'text', maxLength: 40, label: 'Telefon' },
        { name: 'einwilligungAm', type: 'date', label: 'Einwilligung am' },
      ],
    },
  ],
}

async function naechsteNummer(req: import('payload').PayloadRequest): Promise<string> {
  const jahr = datumBerlin(new Date()).slice(0, 4)
  const praefix = `${(await ladeEinstellungen(req)).nummernPraefix}-${jahr}-`
  const letzte = await req.payload.find({
    collection: 'auftraege',
    where: { nummer: { like: praefix } },
    sort: '-nummer',
    limit: 1,
    depth: 0,
    pagination: false,
    req,
    overrideAccess: true,
  })
  const n = letzte.docs[0]?.nummer ? Number(letzte.docs[0].nummer.slice(praefix.length)) : 0
  return `${praefix}${String((Number.isFinite(n) ? n : 0) + 1).padStart(4, '0')}`
}
