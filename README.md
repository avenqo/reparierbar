<p align="center"><img src="backend/public/logo.svg" alt="ReparierBar" width="96"></p>

# ReparierBar

Terminanmeldung für **Repair Cafés** – gedacht für jede Kommune, die ein Repair Café betreibt. Das Repair Café Kremmen ist der erste Nutzer.

Gäste melden ein defektes Gerät mit Beschreibung und bis zu 3 Bildern an und wünschen sich eine Ankunftszeit. Die ehrenamtlichen Reparistas sehen die Anfragen vorab, bereiten sich mit Anleitungen und Videos vor und sagen Termine zu. Wer zusagt, wird Verantwortlicher für den Auftrag – ein bestätigter Termin heißt: Es ist jemand da.

Das ausführliche Konzept steht in [`docs/ReparierBar-Konzept.md`](docs/ReparierBar-Konzept.md).

## Kurz erklärt

- **Feste Tage, flexible Uhrzeit.** Admins legen die Veranstaltungstage fest. Vorgabe ist 10:00–14:00 Uhr mit Ankunft bis 13:00 Uhr im 15-Minuten-Raster und einer Stunde je Reparatur; alles ist je Veranstaltung und als Vorgabe in den Einstellungen änderbar.
- **Kein Login für Gäste.** Zu jeder Anfrage gehört ein persönlicher Link. Ohne E-Mail ist eine Anmeldung möglich, aber ohne Reservierung.
- **Reparistas und Admins** melden sich mit E-Mail und Passwort an. Sie bestätigen Termine, machen Gegenvorschläge, übernehmen Aufträge, ändern Termine, legen telefonische Anmeldungen an und pflegen Recherche-Notizen.
- **Datensparsam:** Die öffentliche Belegung zeigt nur Ankunftszeit, Gerätekategorie, Hersteller und Typ. Kontaktdaten sehen nur der verantwortliche Reparista und Admins; Bilder werden ohne EXIF/GPS gespeichert; Kontaktdaten und Bilder werden nach der Löschfrist (Standard 12 Monate) gelöscht.
- **Generisch:** Name, Auftragsnummern-Präfix, Farben, Logo und Standardzeiten stehen in den *Einstellungen* im Admin-Panel und sind öffentlich lesbar unter `GET /api/globals/einstellungen`. Mails, Kalendereinträge und Frontends übernehmen sie. Pro Kommune läuft eine eigene Instanz.

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| [`backend/`](backend) | Payload 3 auf Next.js: REST-API, Admin-Panel, Jobs. SQLite-Datenbank, Bilder im Dateisystem. |
| [`web/`](web) | Web-Frontend für Gäste und Reparistas – kommt später ([Plan](web/README.md)). |
| [`openapi/`](openapi) | Vertrag der Fach- und der benötigten Standard-Endpunkte; Grundlage für Web-Frontend und Dart-Client der Ortsfunk-App. |
| [`docs/`](docs) | Konzept, [Ortsfunk-Spezifikation](docs/Ortsfunk-Spezifikation.md), [Datenschutz-Vorlage](docs/Datenschutz-Vorlage.md). |

Frontends sprechen nur die REST-API an. Das Admin-Panel unter `/admin` reicht für den Anfang für Reparistas und Admins.

## Mit Docker starten

```bash
cp .env.example .env     # PAYLOAD_SECRET (langer Zufallswert), PUBLIC_URL, INSTANZ_NAME, SMTP … eintragen
docker compose up -d --build
```

Der Dienst hört auf `127.0.0.1:3100` (hinter einen Reverse Proxy mit TLS stellen). Beim Start laufen die Datenbank-Migrationen. Die SQLite-Datei und die Bilder liegen im Volume `daten`.

Danach `PUBLIC_URL/admin` öffnen: Der erste angelegte Benutzer wird Admin. Dann unter *Einstellungen* Name, Farben und Standardzeiten setzen, unter *Veranstaltungen* die Termine anlegen und unter *Benutzer* die Reparistas einladen (Passwort setzen sie über „Passwort vergessen“). Gerätekategorien werden beim ersten Start vorbelegt und sind frei pflegbar.

**Backup:** das Volume `daten` sichern (SQLite-Datei per `sqlite3 reparierbar.db ".backup …"` kopieren, solange die App läuft, und den Ordner `bilder`).

## Lokal entwickeln

Voraussetzung: Node.js ≥ 22.

```bash
cd backend
cp .env.example .env
npm install
DB_PUSH=true npm run dev      # http://localhost:3000/admin
```

```bash
npm run typecheck             # TypeScript prüfen
npm test                      # Unit-Tests (Zeit, Termin-Regeln, Token)
npm run e2e                   # Ende-zu-Ende-Test gegen ein laufendes Backend mit frischer Datenbank
npm run test:jobs             # Erinnerung und Löschfrist (frische Datenbank)
npm run generate:types        # nach Schema-Änderungen
npm run migrate:create        # Migration für Schema-Änderungen erzeugen und einchecken
```

Ohne `SMTP_HOST` werden keine Mails verschickt. Sie erscheinen als Jobs in der Jobs-Collection (Admin-Panel, Gruppe „System“), Fehler ebenfalls.

## Schnittstelle in Kürze

| Wer | Pfad | Zweck |
| --- | --- | --- |
| öffentlich | `GET /api/globals/einstellungen` | Name, Farben, Standardzeiten |
| öffentlich | `GET /api/veranstaltungen`, `/api/geraetekategorien` | Termine und Auswahllisten |
| öffentlich | `GET /api/veranstaltungen/:id/belegung` | Belegung ohne Personendaten |
| Gast | `POST /api/gast/anfrage` | Anfrage ohne Login, Antwort mit persönlichem Link |
| Gast per Link | `GET`/`PATCH /api/gast/auftrag`, `…/bilder`, `…/vorschlag/annehmen\|ablehnen`, `…/stornieren` | eigenen Auftrag verwalten |
| Reparista | `POST /api/auftraege/telefon`, `/:id/bestaetigen\|gegenvorschlag\|termin\|uebernehmen\|abgeben\|abschliessen\|stornieren` | Statuswechsel |
| Reparista | `GET /api/veranstaltungen/:id/tagesliste` | Tagesliste mit Notizen |
| Admin | `POST /api/admin/bereinigung` | Aufträge vor einem Datum löschen (`dryRun`) |

Alle Details: [`openapi/openapi.yaml`](openapi/openapi.yaml).

## Stand

Umgesetzt ist das Backend aus Stufe 1 des Konzepts. Typecheck, Unit-Tests, ein Ende-zu-Ende-Test (20 Prüfungen) und ein Jobs-Test laufen gegen SQLite durch. Der Docker-Build wurde noch nicht ausgeführt.

Offen:

- Web-Frontend (`web/`), Dart-Client und Bereich „Repair Café“ in der Ortsfunk-App
- Admin-Ansicht für die Tagesliste (der Endpunkt existiert)
- Push-Benachrichtigungen, Reparaturstatistik
- Impressum, Datenschutzhinweise, AV-Verträge je Betreiber

## Lizenz

[GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0). Wer die Software als Webdienst betreibt und verändert, muss den geänderten Quellcode den Nutzern bereitstellen.
