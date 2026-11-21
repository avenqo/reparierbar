import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-sqlite'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_benutzer\` (
  	\`id\` integer PRIMARY KEY NOT NULL,
  	\`name\` text NOT NULL,
  	\`rolle\` text DEFAULT 'REPARISTA',
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
  await db.run(sql`INSERT INTO \`__new_benutzer\`("id", "name", "rolle", "aktiv", "updated_at", "created_at", "email", "reset_password_token", "reset_password_expiration", "salt", "hash", "reset_password_requested_at", "login_attempts", "lock_until") SELECT "id", "name", "rolle", "aktiv", "updated_at", "created_at", "email", "reset_password_token", "reset_password_expiration", "salt", "hash", "reset_password_requested_at", "login_attempts", "lock_until" FROM \`benutzer\`;`)
  await db.run(sql`DROP TABLE \`benutzer\`;`)
  await db.run(sql`ALTER TABLE \`__new_benutzer\` RENAME TO \`benutzer\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`benutzer_updated_at_idx\` ON \`benutzer\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`benutzer_created_at_idx\` ON \`benutzer\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`benutzer_email_idx\` ON \`benutzer\` (\`email\`);`)
  await db.run(sql`ALTER TABLE \`auftraege\` ADD \`kontakt_einwilligung_version\` text;`)
  await db.run(sql`ALTER TABLE \`einstellungen\` ADD \`impressum\` text;`)
  await db.run(sql`ALTER TABLE \`einstellungen\` ADD \`datenschutz\` text;`)
  await db.run(sql`ALTER TABLE \`einstellungen\` ADD \`einwilligungstext\` text DEFAULT 'Ich bin damit einverstanden, dass meine Kontaktdaten (Name, E-Mail, Telefon) zur Abstimmung des Reparaturtermins gespeichert und für Mitteilungen zu meiner Anfrage verwendet werden. Sie werden nach Ablauf der Löschfrist nach dem Termin gelöscht. Details stehen in den Datenschutzhinweisen.' NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.run(sql`PRAGMA foreign_keys=OFF;`)
  await db.run(sql`CREATE TABLE \`__new_benutzer\` (
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
  await db.run(sql`INSERT INTO \`__new_benutzer\`("id", "name", "rolle", "aktiv", "updated_at", "created_at", "email", "reset_password_token", "reset_password_expiration", "salt", "hash", "reset_password_requested_at", "login_attempts", "lock_until") SELECT "id", "name", "rolle", "aktiv", "updated_at", "created_at", "email", "reset_password_token", "reset_password_expiration", "salt", "hash", "reset_password_requested_at", "login_attempts", "lock_until" FROM \`benutzer\`;`)
  await db.run(sql`DROP TABLE \`benutzer\`;`)
  await db.run(sql`ALTER TABLE \`__new_benutzer\` RENAME TO \`benutzer\`;`)
  await db.run(sql`PRAGMA foreign_keys=ON;`)
  await db.run(sql`CREATE INDEX \`benutzer_updated_at_idx\` ON \`benutzer\` (\`updated_at\`);`)
  await db.run(sql`CREATE INDEX \`benutzer_created_at_idx\` ON \`benutzer\` (\`created_at\`);`)
  await db.run(sql`CREATE UNIQUE INDEX \`benutzer_email_idx\` ON \`benutzer\` (\`email\`);`)
  await db.run(sql`ALTER TABLE \`auftraege\` DROP COLUMN \`kontakt_einwilligung_version\`;`)
  await db.run(sql`ALTER TABLE \`einstellungen\` DROP COLUMN \`impressum\`;`)
  await db.run(sql`ALTER TABLE \`einstellungen\` DROP COLUMN \`datenschutz\`;`)
  await db.run(sql`ALTER TABLE \`einstellungen\` DROP COLUMN \`einwilligungstext\`;`)
}
