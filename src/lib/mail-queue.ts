import type { PayloadRequest } from 'payload'

export type MailVorlage =
  | 'eingegangen'
  | 'uebernommen'
  | 'bestaetigt'
  | 'gegenvorschlag'
  | 'termin_geaendert'
  | 'erinnerung'
  | 'vorschlag_beantwortet'
  | 'storno'
  | 'vertretung_gesucht'
  | 'unbestaetigt_hinweis'

export type MailJob = { vorlage: MailVorlage; auftragId: number | string; extra?: Record<string, unknown> }

/** Reiht Mail-Jobs in die Jobs Queue ein – mit `req`, also innerhalb der laufenden Transaktion. */
export async function reiheMailsEin(req: PayloadRequest, mails: MailJob[]) {
  for (const m of mails) {
    await req.payload.jobs.queue({
      task: 'sendeMail',
      queue: 'default',
      input: { vorlage: m.vorlage, auftragId: Number(m.auftragId), extra: (m.extra ?? {}) as never },
      req,
    })
  }
}
