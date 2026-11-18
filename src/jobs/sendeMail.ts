import type { TaskConfig } from 'payload'
import { versendeVorlage } from '../lib/mail'
import type { MailVorlage } from '../lib/mail-queue'

/** Ein Mail-Versand = ein Job. Fehlgeschlagene Versuche wiederholt die Jobs Queue. */
export const sendeMail: TaskConfig<'sendeMail'> = {
  slug: 'sendeMail',
  retries: 5,
  inputSchema: [
    { name: 'vorlage', type: 'text', required: true },
    { name: 'auftragId', type: 'number', required: true },
    { name: 'extra', type: 'json' },
  ],
  handler: async ({ input, req }) => {
    await versendeVorlage(req, {
      vorlage: input.vorlage as MailVorlage,
      auftragId: input.auftragId,
      extra: (input.extra ?? {}) as Record<string, unknown>,
    })
    return { output: {} }
  },
}
