import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`CREATE TABLE \`auftraege\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`nummer\` text,
  	\`status\` text DEFAULT 'EINGEGANGEN' NOT NULL,
  	\`kanal\` text DEFAULT 'APP' NOT NULL,
  	\`angelegt_von_id\` integer,
  	\`geraetekategorie_id\` integer NOT NULL,
  	\`hersteller\` text,
  	\`typ\` text,
  	\`fehlerbeschreibung\` text,
  	\`veranstaltung_id\` integer NOT NULL,
  	\`wunsch_ankunft\` text,
  	\`termin_ankunft\` text,
  	\`vorschlag_ankunft\` text,
  	\`dauer_minuten\` numeric,
  	\`verantwortlich_id\` integer,
  	\`vertretung_gesucht\` integer DEFAULT false,
  	\`erinnert_fuer\` text,
  	\`link_schluessel_hash\` text,
  	\`ergebnis\` text,
  	\`email_vorhanden\` integer DEFAULT false,
  	\`anonymisiert_am\` text,
  	\`kontakt_name\` text,
  	\`kontakt_email\` text,
  	\`kontakt_telefon\` text,
  	\`kontakt_einwilligung_am\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`angelegt_von_id\`) REFERENCES \`benutzer\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`geraetekategorie_id\`) REFERENCES \`geraetekategorien\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`veranstaltung_id\`) REFERENCES \`veranstaltungen\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`verantwortlich_id\`) REFERENCES \`benutzer\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`auftraege_nummer_idx\` ON \`auftraege\` (\`nummer\`);`)
  await db.run(sql`CREATE INDEX \`auftraege_status_idx\` ON \`auftraege\` (\`status\`);`)
  await db.run(sql`CREATE INDEX \`auftraege_angelegt_von_idx\` ON \`auftraege\` (\`angelegt_von_id\`);`)
  await db.run(sql`CREATE INDEX \`auftraege_geraetekategorie_idx\` ON \`auftraege\` (\`geraetekategorie_id\`);`)
  await db.run(sql`CREATE INDEX \`auftraege_veranstaltung_idx\` ON \`auftraege\` (\`veranstaltung_id\`);`)
  await db.run(sql`CREATE INDEX \`auftraege_verantwortlich_idx\` ON \`auftraege\` (\`verantwortlich_id\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`auftraege_link_schluessel_hash_idx\` ON \`auftraege\` (\`link_schluessel_hash\`);`)
  await db.run(sql`CREATE INDEX \`auftraege_kontakt_kontakt_email_idx\` ON \`auftraege\` (\`kontakt_email\`);`)
  await db.run(sql`CREATE INDEX \`auftraege_updated_at_idx\` ON \`auftraege\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`auftraege_created_at_idx\` ON \`auftraege\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`bilder\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`auftrag_id\` integer NOT NULL,
  	\`reihenfolge\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`url\` text,
  	\`thumbnail_u_r_l\` text,
  	\`filename\` text,
  	\`mime_type\` text,
  	\`filesize\` numeric,
  	\`width\` numeric,
  	\`height\` numeric,
  	\`focal_x\` numeric,
  	\`focal_y\` numeric,
  	\`sizes_vorschau_url\` text,
  	\`sizes_vorschau_width\` numeric,
  	\`sizes_vorschau_height\` numeric,
  	\`sizes_vorschau_mime_type\` text,
  	\`sizes_vorschau_filesize\` numeric,
  	\`sizes_vorschau_filename\` text,
  	FOREIGN KEY (\`auftrag_id\`) REFERENCES \`auftraege\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`bilder_auftrag_idx\` ON \`bilder\` (\`auftrag_id\`);`)
  await db.run(sql`CREATE INDEX \`bilder_updated_at_idx\` ON \`bilder\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`bilder_created_at_idx\` ON \`bilder\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`bilder_filename_idx\` ON \`bilder\` (\`filename\`);`)
  await db.run(sql`CREATE INDEX \`bilder_sizes_vorschau_sizes_vorschau_filename_idx\` ON \`bilder\` (\`sizes_vorschau_filename\`);`)
  await db.run(sql`CREATE TABLE \`notizen\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`auftrag_id\` integer NOT NULL,
  	\`autor_id\` integer,
  	\`text\` text NOT NULL,
  	\`link\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`auftrag_id\`) REFERENCES \`auftraege\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`autor_id\`) REFERENCES \`benutzer\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`notizen_auftrag_idx\` ON \`notizen\` (\`auftrag_id\`);`)
  await db.run(sql`CREATE INDEX \`notizen_autor_idx\` ON \`notizen\` (\`autor_id\`);`)
  await db.run(sql`CREATE INDEX \`notizen_updated_at_idx\` ON \`notizen\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`notizen_created_at_idx\` ON \`notizen\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`ereignisse\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`auftrag_id\` integer NOT NULL,
  	\`zeitpunkt\` text NOT NULL,
  	\`akteur_typ\` text NOT NULL,
  	\`akteur_id\` integer,
  	\`aktion\` text NOT NULL,
  	\`vorher\` text,
  	\`nachher\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	FOREIGN KEY (\`auftrag_id\`) REFERENCES \`auftraege\`(\`id\`) ON UPDATE no action ON DELETE set null,
  	FOREIGN KEY (\`akteur_id\`) REFERENCES \`benutzer\`(\`id\`) ON UPDATE no action ON DELETE set null
  );
  `)
  await db.run(sql`CREATE INDEX \`ereignisse_auftrag_idx\` ON \`ereignisse\` (\`auftrag_id\`);`)
  await db.run(sql`CREATE INDEX \`ereignisse_akteur_idx\` ON \`ereignisse\` (\`akteur_id\`);`)
  await db.run(sql`CREATE INDEX \`ereignisse_updated_at_idx\` ON \`ereignisse\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`ereignisse_created_at_idx\` ON \`ereignisse\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`veranstaltungen\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`datum\` text NOT NULL,
  	\`beginn\` text NOT NULL,
  	\`ende\` text NOT NULL,
  	\`letzte_ankunft\` text NOT NULL,
  	\`raster_minuten\` numeric NOT NULL,
  	\`ort\` text NOT NULL,
  	\`anmeldeschluss\` text,
  	\`status\` text DEFAULT 'GEPLANT' NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`veranstaltungen_updated_at_idx\` ON \`veranstaltungen\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`veranstaltungen_created_at_idx\` ON \`veranstaltungen\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`geraetekategorien\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`reihenfolge\` numeric DEFAULT 100,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`geraetekategorien_name_idx\` ON \`geraetekategorien\` (\`name\`);`)
  await db.run(sql`CREATE INDEX \`geraetekategorien_updated_at_idx\` ON \`geraetekategorien\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`geraetekategorien_created_at_idx\` ON \`geraetekategorien\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`benutzer_sessions\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`created_at\` text,
  	\`expires_at\` text NOT NULL,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`benutzer\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`benutzer_sessions_order_idx\` ON \`benutzer_sessions\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`benutzer_sessions_parent_id_idx\` ON \`benutzer_sessions\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`benutzer\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`rolle\` text DEFAULT 'REPARISTA' NOT NULL,
  	\`aktiv\` integer DEFAULT true,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`email\` text NOT NULL,
  	\`reset_password_token\` text,
  	\`reset_password_expiration\` text,
  	\`salt\` text,
  	\`hash\` text,
  	\`reset_password_requested_at\` text,
  	\`login_attempts\` numeric DEFAULT 0,
  	\`lock_until\` text
  );
  `)
  await db.run(sql`CREATE INDEX \`benutzer_updated_at_idx\` ON \`benutzer\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`benutzer_created_at_idx\` ON \`benutzer\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`benutzer_email_idx\` ON \`benutzer\` (\`email\`);`)
  await db.run(sql`CREATE TABLE \`benutzer_texts\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer NOT NULL,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`text\` text,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`benutzer\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`benutzer_texts_order_parent\` ON \`benutzer_texts\` (\`order\`,\`parent_id\`);`)
  await db.run(sql`CREATE TABLE \`email_sperren\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`email_hash\` text NOT NULL,
  	\`gesperrt_am\` text NOT NULL,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`email_sperren_email_hash_idx\` ON \`email_sperren\` (\`email_hash\`);`)
  await db.run(sql`CREATE INDEX \`email_sperren_updated_at_idx\` ON \`email_sperren\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`email_sperren_created_at_idx\` ON \`email_sperren\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_kv\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text NOT NULL,
  	\`data\` text NOT NULL
  );
  `)
  await db.run(sql`CREATE UNIQUE INDEX \`payload_kv_key_idx\` ON \`payload_kv\` (\`key\`);`)
  await db.run(sql`CREATE TABLE \`payload_jobs_log\` (
  	\`_order\` integer NOT NULL,
  	\`_parent_id\` integer NOT NULL,
  	\`id\` text PRIMARY KEY NOT NULL,
  	\`executed_at\` text NOT NULL,
  	\`completed_at\` text NOT NULL,
  	\`task_slug\` text NOT NULL,
  	\`task_i_d\` text NOT NULL,
  	\`input\` text,
  	\`output\` text,
  	\`state\` text NOT NULL,
  	\`error\` text,
  	FOREIGN KEY (\`_parent_id\`) REFERENCES \`payload_jobs\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_jobs_log_order_idx\` ON \`payload_jobs_log\` (\`_order\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_log_parent_id_idx\` ON \`payload_jobs_log\` (\`_parent_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_jobs\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`input\` text,
  	\`completed_at\` text,
  	\`total_tried\` numeric DEFAULT 0,
  	\`has_error\` integer DEFAULT false,
  	\`error\` text,
  	\`task_slug\` text,
  	\`queue\` text DEFAULT 'default',
  	\`wait_until\` text,
  	\`processing\` integer DEFAULT false,
  	\`meta\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_jobs_completed_at_idx\` ON \`payload_jobs\` (\`completed_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_total_tried_idx\` ON \`payload_jobs\` (\`total_tried\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_has_error_idx\` ON \`payload_jobs\` (\`has_error\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_task_slug_idx\` ON \`payload_jobs\` (\`task_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_queue_idx\` ON \`payload_jobs\` (\`queue\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_wait_until_idx\` ON \`payload_jobs\` (\`wait_until\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_processing_idx\` ON \`payload_jobs\` (\`processing\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_updated_at_idx\` ON \`payload_jobs\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_jobs_created_at_idx\` ON \`payload_jobs\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`global_slug\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_global_slug_idx\` ON \`payload_locked_documents\` (\`global_slug\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_updated_at_idx\` ON \`payload_locked_documents\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_created_at_idx\` ON \`payload_locked_documents\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_locked_documents_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`auftraege_id\` integer,
  	\`bilder_id\` integer,
  	\`notizen_id\` integer,
  	\`ereignisse_id\` integer,
  	\`veranstaltungen_id\` integer,
  	\`geraetekategorien_id\` integer,
  	\`benutzer_id\` integer,
  	\`email_sperren_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_locked_documents\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`auftraege_id\`) REFERENCES \`auftraege\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`bilder_id\`) REFERENCES \`bilder\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`notizen_id\`) REFERENCES \`notizen\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`ereignisse_id\`) REFERENCES \`ereignisse\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`veranstaltungen_id\`) REFERENCES \`veranstaltungen\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`geraetekategorien_id\`) REFERENCES \`geraetekategorien\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`benutzer_id\`) REFERENCES \`benutzer\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`email_sperren_id\`) REFERENCES \`email_sperren\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_order_idx\` ON \`payload_locked_documents_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_parent_idx\` ON \`payload_locked_documents_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_path_idx\` ON \`payload_locked_documents_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_auftraege_id_idx\` ON \`payload_locked_documents_rels\` (\`auftraege_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_bilder_id_idx\` ON \`payload_locked_documents_rels\` (\`bilder_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_notizen_id_idx\` ON \`payload_locked_documents_rels\` (\`notizen_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_ereignisse_id_idx\` ON \`payload_locked_documents_rels\` (\`ereignisse_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_veranstaltungen_id_idx\` ON \`payload_locked_documents_rels\` (\`veranstaltungen_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_geraetekategorien_id_idx\` ON \`payload_locked_documents_rels\` (\`geraetekategorien_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_benutzer_id_idx\` ON \`payload_locked_documents_rels\` (\`benutzer_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_locked_documents_rels_email_sperren_id_idx\` ON \`payload_locked_documents_rels\` (\`email_sperren_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`key\` text,
  	\`value\` text,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_key_idx\` ON \`payload_preferences\` (\`key\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_updated_at_idx\` ON \`payload_preferences\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_created_at_idx\` ON \`payload_preferences\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`payload_preferences_rels\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`order\` integer,
  	\`parent_id\` integer NOT NULL,
  	\`path\` text NOT NULL,
  	\`benutzer_id\` integer,
  	FOREIGN KEY (\`parent_id\`) REFERENCES \`payload_preferences\`(\`id\`) ON UPDATE no action ON DELETE cascade,
  	FOREIGN KEY (\`benutzer_id\`) REFERENCES \`benutzer\`(\`id\`) ON UPDATE no action ON DELETE cascade
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_order_idx\` ON \`payload_preferences_rels\` (\`order\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_parent_idx\` ON \`payload_preferences_rels\` (\`parent_id\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_path_idx\` ON \`payload_preferences_rels\` (\`path\`);`)
  await db.run(sql`CREATE INDEX \`payload_preferences_rels_benutzer_id_idx\` ON \`payload_preferences_rels\` (\`benutzer_id\`);`)
  await db.run(sql`CREATE TABLE \`payload_migrations\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text,
  	\`batch\` numeric,
  	\`updated_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
  	\`created_at\` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
  );
  `)
  await db.run(sql`CREATE INDEX \`payload_migrations_updated_at_idx\` ON \`payload_migrations\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`payload_migrations_created_at_idx\` ON \`payload_migrations\` (\`created_at\`);`)
  await db.run(sql`CREATE TABLE \`einstellungen\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text DEFAULT 'Repair Café' NOT NULL,
  	\`nummern_praefix\` text DEFAULT 'RC' NOT NULL,
  	\`kontakt_email\` text,
  	\`webseite_url\` text,
  	\`impressum_url\` text,
  	\`datenschutz_url\` text,
  	\`farbe_primaer\` text DEFAULT '#1e6f5c',
  	\`farbe_akzent\` text DEFAULT '#f2a900',
  	\`farbe_text\` text DEFAULT '#1d2b2a',
  	\`logo_url\` text,
  	\`standard_beginn\` text DEFAULT '10:00',
  	\`standard_ende\` text DEFAULT '14:00',
  	\`standard_letzte_ankunft\` text DEFAULT '13:00',
  	\`standard_raster\` numeric DEFAULT 15,
  	\`standard_dauer_minuten\` numeric DEFAULT 60,
  	\`loeschfrist_monate\` numeric DEFAULT 12,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
  await db.run(sql`CREATE TABLE \`payload_jobs_stats\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`stats\` text,
  	\`updated_at\` text,
  	\`created_at\` text
  );
  `)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`DROP TABLE \`auftraege\`;`)
  await db.run(sql`DROP TABLE \`bilder\`;`)
  await db.run(sql`DROP TABLE \`notizen\`;`)
  await db.run(sql`DROP TABLE \`ereignisse\`;`)
  await db.run(sql`DROP TABLE \`veranstaltungen\`;`)
  await db.run(sql`DROP TABLE \`geraetekategorien\`;`)
  await db.run(sql`DROP TABLE \`benutzer_sessions\`;`)
  await db.run(sql`DROP TABLE \`benutzer\`;`)
  await db.run(sql`DROP TABLE \`benutzer_texts\`;`)
  await db.run(sql`DROP TABLE \`email_sperren\`;`)
  await db.run(sql`DROP TABLE \`payload_kv\`;`)
  await db.run(sql`DROP TABLE \`payload_jobs_log\`;`)
  await db.run(sql`DROP TABLE \`payload_jobs\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents\`;`)
  await db.run(sql`DROP TABLE \`payload_locked_documents_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences\`;`)
  await db.run(sql`DROP TABLE \`payload_preferences_rels\`;`)
  await db.run(sql`DROP TABLE \`payload_migrations\`;`)
  await db.run(sql`DROP TABLE \`einstellungen\`;`)
  await db.run(sql`DROP TABLE \`payload_jobs_stats\`;`)
}
