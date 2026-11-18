import { postgresAdapter } from '@payloadcms/db-postgres'
import { nodemailerAdapter } from '@payloadcms/email-nodemailer'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { de } from '@payloadcms/translations/languages/de'
import nodemailer from 'nodemailer'
import path from 'node:path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'

import { Auftraege } from './collections/Auftraege'
import { Benutzer } from './collections/Benutzer'
import { Bilder } from './collections/Bilder'
import { EmailSperren } from './collections/EmailSperren'
import { Ereignisse } from './collections/Ereignisse'
import { Geraetekategorien } from './collections/Geraetekategorien'
import { Notizen } from './collections/Notizen'
import { Veranstaltungen } from './collections/Veranstaltungen'
import { bereinigung, health } from './endpoints/admin'
import { gastEndpoints } from './endpoints/gast'
import { erinnerung } from './jobs/erinnerung'
import { loeschung } from './jobs/loeschung'
import { sendeMail } from './jobs/sendeMail'
import { istAdmin } from './access'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const publicUrl = (process.env.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '')
const weitereOrigins = (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
const origins = [publicUrl, ...weitereOrigins]

const smtpHost = process.env.SMTP_HOST
const email = nodemailerAdapter({
  defaultFromAddress: process.env.MAIL_FROM || 'repaircafe@localhost',
  defaultFromName: process.env.MAIL_FROM_NAME || 'Repair Café Kremmen',
  // Ohne SMTP_HOST wird nur geloggt (JSON-Transport), damit lokale Entwicklung ohne Mailserver läuft.
  transport: smtpHost
    ? (nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT || 587),
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      }) as never)
    : (nodemailer.createTransport({ jsonTransport: true }) as never),
})

export default buildConfig({
  serverURL: publicUrl,
  secret: process.env.PAYLOAD_SECRET || '',
  admin: {
    user: 'benutzer',
    importMap: { baseDir: path.resolve(dirname) },
    meta: { titleSuffix: ' – ReparierBar' },
  },
  collections: [Auftraege, Bilder, Notizen, Ereignisse, Veranstaltungen, Geraetekategorien, Benutzer, EmailSperren],
  endpoints: [...gastEndpoints, bereinigung, health],
  editor: lexicalEditor(),
  db: postgresAdapter({
    pool: { connectionString: process.env.DATABASE_URI },
    push: process.env.DB_PUSH === 'true',
    migrationDir: path.resolve(dirname, 'migrations'),
  }),
  email,
  sharp,
  i18n: { supportedLanguages: { de }, fallbackLanguage: 'de' },
  cors: origins,
  csrf: origins,
  upload: { limits: { fileSize: 5 * 1024 * 1024 } },
  typescript: { outputFile: path.resolve(dirname, 'payload-types.ts') },
  jobs: {
    tasks: [sendeMail, erinnerung, loeschung],
    // Mails jede Minute, geplante Tagesaufgaben (Erinnerung, Löschfrist) über die Queue „taeglich“
    autoRun: [
      { cron: '* * * * *', queue: 'default', limit: 20 },
      { cron: '* * * * *', queue: 'taeglich', limit: 5 },
    ],
    access: { run: ({ req }) => istAdmin(req.user) },
  },
})
