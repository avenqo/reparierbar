# ReparierBar

Terminanmeldung für das **Repair Café Kremmen**.

Gäste melden ein defektes Gerät mit Beschreibung und bis zu 3 Bildern an und wünschen sich eine Ankunftszeit. Die ehrenamtlichen Reparistas sehen die Anfragen vorab, bereiten sich mit Anleitungen und Videos vor und sagen Termine zu. Wer zusagt, wird Verantwortlicher für den Auftrag – ein bestätigter Termin heißt: Es ist jemand da.

Das ausführliche Konzept steht in [`docs/ReparierBar-Konzept.md`](docs/ReparierBar-Konzept.md).

## Kurz erklärt

- **Feste Termine** von 10:00 bis 14:00 Uhr, keine festen Zeitfenster. Der Gast wünscht eine Ankunftszeit (Raster 15 Minuten, letzte Ankunft 13:00 Uhr), pro Reparatur ist mindestens eine Stunde eingeplant.
- **Kein Login für Gäste.** Zu jeder Anfrage gehört ein persönlicher Link; die Ortsfunk-App speichert ihn automatisch, die Bestätigungsmail liefert ihn mit. Ohne E-Mail ist eine Anmeldung möglich, aber ohne Reservierung.
- **Reparistas und Admins** melden sich mit E-Mail und Passwort an (Admin-Panel unter `/admin`). Sie bestätigen Termine, machen Gegenvorschläge, übernehmen Aufträge, ändern Termine, legen telefonische Anmeldungen an und pflegen Recherche-Notizen.
- **Datensparsam:** Die öffentliche Belegung zeigt nur Ankunftszeit, Gerätekategorie, Hersteller und Typ. Kontaktdaten sehen nur der verantwortliche Reparista und Admins; Bilder werden ohne EXIF/GPS gespeichert; Kontaktdaten und Bilder werden 12 Monate nach dem Termin gelöscht.
- Die **Ortsfunk-App** (Flutter) ist das erste Frontend und nutzt dieselben REST-Endpunkte wie jedes spätere Frontend. Die Anwendung läuft getrennt von Directus und von Beirat-dabei.

## Technik

| Baustein | Umsetzung |
| --- | --- |
| Anwendung | Payload 3 auf Next.js, TypeScript |
| Datenbank | PostgreSQL 16 (`@payloadcms/db-postgres`) |
| Benutzer | Auth-Collection `benutzer` mit Rollen `REPARISTA` und `ADMIN` |
| Gast-Zugang | persönlicher Link mit 256-Bit-Schlüssel (nur SHA-256-Hash in der DB), Header `X-Auftrag-Schluessel` |
| Fachlogik | eigene Endpunkte für Statuswechsel (bedingte Updates, `409 Conflict`), Historie in `ereignisse`, Rechte-Regeln und Hooks |
| Mail | SMTP über `nodemailer`, Versand als Job in der Payload Jobs Queue |
| Zeitgesteuert | Erinnerung am Vortag (10:00 Uhr), Hinweis an Admins bei unbestätigten Anfragen (3 Tage vorher), Löschfrist (nachts) |
| Bilder | Upload-Collection mit sharp (max. 1600 px, JPEG, ohne EXIF), höchstens 3 je Auftrag |
| API-Vertrag | [`openapi/openapi.yaml`](openapi/openapi.yaml) für die Fach-Endpunkte (Grundlage für den Dart-Client) |
| Betrieb | Docker Compose auf `ofuk125`, Domain `repaircafe.kremmener.info` |

## Projektstruktur

```
docs/                  Konzept
openapi/openapi.yaml   OpenAPI-Beschreibung der Fach-Endpunkte
src/
  payload.config.ts    Konfiguration (DB, Mail, Jobs, CORS/CSRF)
  collections/         auftraege, bilder, notizen, ereignisse, veranstaltungen,
                       geraetekategorien, benutzer, email-sperren
  access/              Rechte-Hilfen
  endpoints/           gast, auftraege (Reparista), veranstaltungen (Belegung, Tagesliste), admin
  lib/                 Auftrags-Service (Statuswechsel), Mail-Vorlagen, Token, Zeit, ICS
  jobs/                sendeMail, erinnerung, loeschung
  components/          Aktions-Knöpfe im Admin-Panel
  app/                 Next.js (Admin, API-Routen, Platzhalter für persönliche Links)
tests/                 Unit-Tests (Zeit, Termin-Regeln, Token)
```

## Lokal entwickeln

Voraussetzungen: Node.js ≥ 22 und eine PostgreSQL-16-Datenbank.

```bash
cp .env.example .env          # PAYLOAD_SECRET, DATABASE_URI usw. anpassen
# für die lokale Entwicklung: DB_PUSH=true (Schema wird direkt angelegt)
npm install
npm run dev                   # http://localhost:3000/admin – ersten Admin anlegen
```

Nützliche Befehle:

```bash
npm run typecheck             # TypeScript prüfen
npm test                      # Unit-Tests
npm run generate:types        # src/payload-types.ts nach Schema-Änderungen neu erzeugen
npm run generate:importmap    # Admin-Importmap nach neuen Komponenten
npm run migrate:create        # Migration aus dem aktuellen Schema erzeugen
```

Ohne `SMTP_HOST` werden Mails nicht verschickt, sondern nur über den JSON-Transport erzeugt.

Nach dem Anlegen des ersten Admins werden unter *Gerätekategorien* die Auswahlwerte und unter *Veranstaltungen* die Termine gepflegt. Reparistas legt ein Admin unter *Benutzer* an; Passwort setzen sie über „Passwort vergessen“.

## Deployment

```bash
cp .env.example .env          # Werte für den Server eintragen, DB_PASSWORD setzen, DB_PUSH=false
docker compose up -d --build
```

Der Stack besteht aus `rc-app` (Payload + Next.js), `rc-db` (PostgreSQL 16, nur im internen Docker-Netz) und dem Volume `rc-bilder`. `rc-app` hört auf `127.0.0.1:3100`; der bestehende Reverse Proxy leitet `repaircafe.kremmener.info` dorthin. Beim Start laufen zuerst die Datenbank-Migrationen (`payload migrate`). Für den Uptime-Check gibt es `/api/health`.

**Vor dem ersten Deployment** muss die Anfangsmigration erzeugt und eingecheckt werden:

```bash
DB_PUSH=false npm run migrate:create   # gegen eine leere lokale Datenbank
```

Backup: nächtlich `pg_dump` der Datenbank plus das Volume `rc-bilder`.

## Schnittstelle in Kürze

| Wer | Pfad | Zweck |
| --- | --- | --- |
| öffentlich | `GET /api/veranstaltungen`, `/api/geraetekategorien` | Termine und Auswahllisten |
| öffentlich | `GET /api/veranstaltungen/:id/belegung` | Belegung ohne Personendaten |
| Gast | `POST /api/gast/anfrage` | Anfrage ohne Login, Antwort mit persönlichem Link |
| Gast per Link | `GET`/`PATCH /api/gast/auftrag`, `…/bilder`, `…/vorschlag/annehmen\|ablehnen`, `…/stornieren` | eigenen Auftrag verwalten |
| Reparista | `POST /api/auftraege/telefon`, `/:id/bestaetigen\|gegenvorschlag\|termin\|uebernehmen\|abgeben\|abschliessen\|stornieren` | Statuswechsel |
| Reparista | `GET /api/veranstaltungen/:id/tagesliste` | Tagesliste mit Notizen |
| Admin | `POST /api/admin/bereinigung` | Aufträge vor einem Datum löschen (`dryRun`) |

Alle Details stehen in der [OpenAPI-Datei](openapi/openapi.yaml).

## Stand

Umgesetzt ist **Stufe 1 des Backends** aus dem Konzept: Collections mit Rechten und Hooks, alle Fach-Endpunkte mit Historie und Überschneidungswarnung, Mails und Jobs, Löschung/Bereinigung, Admin-Knöpfe für die Statuswechsel, OpenAPI, Docker. Typecheck und Unit-Tests laufen; das Zusammenspiel mit PostgreSQL wurde noch nicht gegen eine echte Datenbank getestet.

Noch offen:

- Anfangsmigration erzeugen (siehe oben) und Ende-zu-Ende-Test gegen PostgreSQL
- Admin-Ansicht für die Tagesliste (der Endpunkt existiert)
- Dart-Client aus der OpenAPI-Datei und der Bereich „Repair Café“ in der Ortsfunk-App
- Stufe 2: Gäste-Webseite, Push-Benachrichtigungen, Reparaturstatistik
- Impressum, Datenschutzhinweise, AV-Verträge (Strato, Mailanbieter)
