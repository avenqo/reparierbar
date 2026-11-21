# Ortsfunk: Anbindung an die ReparierBar – Spezifikation

Diese Spezifikation ist in sich abgeschlossen. Sie ist für die Umsetzung in einem eigenen Chat/Projekt gedacht.
Verbindlich für alle Endpunkte und Felder ist `openapi/openapi.yaml` im Repository
<https://github.com/avenqo/reparierbar> (Ordner `openapi/`). Bei Widersprüchen gilt die OpenAPI-Datei.

## 1. Kontext

- **Ortsfunk Kremmen** ist eine Flutter-App (Android/iOS, rund 200 Installationen) mit **Directus** als Backend auf dem Server `ofuk125`.
  Sie zeigt Neuigkeiten, Veranstaltungen („Events“) und anderes aus dem Ort.
- **ReparierBar** ist ein eigenständiges Backend (Payload CMS, SQLite, Docker) für die Terminanmeldung des Repair Cafés Kremmen.
  Es ist generisch gebaut; Name und Farben kommen aus den Einstellungen. Die Ortsfunk-App ist **ein** Client davon (später kommt ein Web-Frontend).
- Die App spricht also mit **zwei Backends**: Directus (wie bisher) und ReparierBar (neu). Basis-URL der ReparierBar-API: Konfiguration der App
  (Vorgabe `https://repaircafe.kremmener.info/api`, pro Build änderbar).
- Die ReparierBar-Funktion ist ein **eigener Bereich** der App und verändert den bisherigen Umgang mit Directus nicht.

## 2. Ziele

1. Gäste melden ein defektes Gerät für einen Repair-Café-Termin an, **ohne Konto**, mit bis zu 3 Fotos, und verfolgen den Stand.
2. Gäste sehen die Belegung eines Termins (ohne Personendaten) und wählen eine Wunsch-Ankunftszeit.
3. Reparistas (Ehrenamtliche) melden sich in der App an, sehen Aufträge, bestätigen Termine, machen Gegenvorschläge, schließen ab, schreiben Notizen.
4. Impressum, Datenschutzhinweise und Einwilligungstext stammen aus der ReparierBar und sind in der App erreichbar.
5. Name, Farben und Logo der Instanz kommen aus der ReparierBar (kein Hardcoding von „Repair Café Kremmen“ im Bereich).

Nicht Ziel: Verwaltung von Benutzern, Veranstaltungen, Kategorien, Einstellungen (das macht der Admin im Admin-Panel der ReparierBar unter `/admin`).

## 3. Rollen und Grundregeln der API

| Rolle | Zugang | Darf |
|---|---|---|
| Gast | kein Login. Persönlicher **Schlüssel** im Header `X-Auftrag-Schluessel` | nur den eigenen Auftrag |
| Reparista | Login (E-Mail/Passwort) → JWT | Aufträge lesen/bearbeiten, Notizen, Tagesliste |
| Admin | wie Reparista, mehr Rechte im Admin-Panel | in der App wie Reparista behandeln |

- Fehlerformat überall: `{ "errors": [{ "message": "…" }] }`. Die `message` ist deutsch und für Nutzer lesbar; sie darf angezeigt werden.
- Statuscodes: 400 ungültig, 401 nicht angemeldet/Schlüssel falsch, 403 keine Rechte, 404 unbekannt, **409 Konflikt** (jemand war schneller), 422 Regel verletzt, 429 zu viele Anfragen.
- **Zeiten:** Die Fach-Endpunkte verwenden `"HH:mm"` in Berliner Ortszeit (Raster der Veranstaltung, Standard 15 Minuten).
  Die Standard-Endpunkte (`/auftraege`, `/veranstaltungen`) liefern **UTC-Zeitstempel** (ISO 8601). Für die Anzeige immer nach `Europe/Berlin` umrechnen
  (Paket `timezone` oder `intl`), nie die Geräte-Zeitzone nehmen. Beim Senden an Fach-Endpunkte `HH:mm` senden, keine Zeitstempel.
- Der Server entscheidet. Die App darf Buttons ausblenden, muss aber 403/409/422 sauber anzeigen und die Daten neu laden.

## 4. Bildschirme und Abläufe

### 4.1 Einstieg
- Menü oben links (Hamburger). Neuer Eintrag **„Repair Café“** (Name aus `einstellungen.name`).
- Unter **„Events“** erscheint bei Repair-Café-Terminen ein Hinweis mit Button „Gerät anmelden“, der zum Anmeldeformular dieses Termins führt.
  Welche Events Repair-Café-Termine sind, ergibt sich aus `GET /veranstaltungen` (nicht aus Directus-Daten raten; falls Directus-Events verknüpft werden sollen, ist das eine getrennte spätere Entscheidung).

### 4.2 Gast: Termin wählen und Belegung
- `GET /veranstaltungen?where[status][equals]=GEPLANT&where[datum][greater_than_equal]=<heute>&sort=datum` → Liste kommender Termine (Datum, Beginn–Ende, Ort).
  Termine mit abgelaufenem `anmeldeschluss` oder `status != GEPLANT` nicht zur Anmeldung anbieten.
- Termin-Detail: `GET /veranstaltungen/{id}/belegung` → Liste `belegung[]` mit `ankunft`, `geraetekategorie`, `hersteller`, `typ`, `status` (`ANGEFRAGT`/`BESTAETIGT`).
  Darstellung als Zeitleiste im Raster. Anzeigen, welche Zeiten schon belegt sind; **Doppelbelegung ist technisch möglich**, die Reparistas lösen das auf. Keine Personendaten verfügbar und keine ableiten.
- Zulässige Ankunftszeiten: von `beginn` bis `letzteAnkunft` im Abstand `rasterMinuten` (aus der Veranstaltung).

### 4.3 Gast: Anmeldeformular
Felder (siehe Schema `Anfrage`):
- Gerätekategorie (Pflicht): `GET /geraetekategorien?sort=reihenfolge&limit=100`, Auswahl.
- Hersteller, Typ (optional, je max. 60 Zeichen; **werden öffentlich in der Belegung angezeigt**, das im Formular so benennen: „wird anderen Gästen angezeigt“).
- Fehlerbeschreibung (Pflicht, max. 2000 Zeichen, nicht öffentlich).
- Fotos: bis zu 3 (siehe 4.4).
- Wunsch-Ankunftszeit (optional). **Nur zusammen mit E-Mail-Adresse zulässig** (sonst 422), weil der Gast sonst keine Rückmeldung bekommt.
- Kontakt (optional): Name, E-Mail, Telefon. Sobald irgendein Kontaktfeld gefüllt ist, ist die **Einwilligung Pflicht** (siehe 4.7).
- Ohne Kontaktdaten ist die Anmeldung erlaubt; der Gast sieht dann den Stand nur in der App.

Absenden: `POST /gast/anfrage` mit `kanal: "APP"`. Antwort `201`: `nummer`, `status`, `schluessel`, `link`.
- **Den `schluessel` sofort im Secure Storage speichern** (`flutter_secure_storage`), zusammen mit `nummer`. Er wird nur dieses eine Mal im Klartext geliefert und ist der einzige Zugang zum Auftrag.
- Danach die Fotos hochladen (4.4) und zur Auftragsansicht (4.5) wechseln.
- 429: zu viele Anfragen je E-Mail-Adresse → Meldung des Servers anzeigen.

### 4.4 Fotos
- Aufnahme mit `image_picker` (Kamera oder Galerie): `maxWidth: 1600`, `imageQuality: 80`, bis zu 3. Der Server verkleinert zusätzlich auf 1600 px, wandelt in JPEG um und entfernt EXIF (inkl. GPS).
- Upload je Foto: `POST /gast/auftrag/bilder` (`multipart/form-data`, Feld `file`, Header `X-Auftrag-Schluessel`). Maximal 3 Bilder, 5 MB, JPEG/PNG/WebP. Fehler (422) anzeigen, Anmeldung bleibt bestehen.
- Löschen: `DELETE /gast/auftrag/bilder?id=<id>`.
- Anzeige im Auftrag: `GastAuftrag.bilder[]` enthält `id`; Bilddatei über `GET /gast/auftrag/bilder/{id}` (mit Schlüssel-Header, daher z. B. `CachedNetworkImage` mit `httpHeaders`).

### 4.5 Gast: „Meine Anmeldungen“
- Liste der lokal gespeicherten Aufträge (Nummer + Schlüssel, Secure Storage). Beim Öffnen `GET /gast/auftrag` aktualisieren.
- Ansicht: Nummer, Status (deutsche Klartexte), Termin (`veranstaltung`, `terminAnkunft`/`wunschAnkunft`), Gerät, Fehlerbeschreibung, Bilder, Ergebnis.
- Status → Text: `EINGEGANGEN` „Eingegangen, wartet auf einen Reparista“, `UEBERNOMMEN` „Übernommen, Termin folgt“, `GEGENVORSCHLAG` „Neuer Zeitvorschlag, bitte antworten“, `BESTAETIGT` „Termin bestätigt“, `ERLEDIGT` „Erledigt“ (+ `ergebnis`), `STORNIERT` „Storniert“.
- Aktionen:
  - Kontakt/Beschreibung nachtragen: `PATCH /gast/auftrag` (`kontakt`, `einwilligung: true`, `fehlerbeschreibung`, `hersteller`, `typ`).
  - Bei `GEGENVORSCHLAG` (Feld `vorschlagAnkunft`): Buttons **Annehmen** `POST /gast/auftrag/vorschlag/annehmen` und **Ablehnen** `POST /gast/auftrag/vorschlag/ablehnen` (mit Schlüssel-Header, leerer Body). 409 → neu laden und Hinweis „Der Stand hat sich geändert“.
  - **Zurückziehen** `POST /gast/auftrag/stornieren` mit Bestätigungsdialog.
- Lokales Entfernen einer Anmeldung aus der Liste ist erlaubt und ändert nichts auf dem Server.
- Pull-to-refresh. Optional: lokale Erinnerung am Tag vor dem Termin (kein Push-Dienst nötig).

### 4.6 App Links (Mail-Link öffnet die App)
- Die Mails enthalten `https://<domain>/a/<nummer>#t=<schluessel>` (persönlicher Link), `#v=<token>&aktion=annehmen|ablehnen` (Gegenvorschlag) und `#n=<token>` („Das war ich nicht“).
  Der Teil nach `#` wird nie an den Server geschickt; **er darf nirgends geloggt oder in Analytics/Crash-Reports landen.**
- Android App Links und iOS Universal Links für Pfad `/a/*` der ReparierBar-Domain einrichten. Der Server liefert
  `/.well-known/assetlinks.json` (aus `ANDROID_PACKAGE`, `ANDROID_SHA256`) und `/.well-known/apple-app-site-association` (aus `IOS_APP_ID`) selbst aus;
  die Werte (Paketname, SHA-256 des Signaturzertifikats **inkl. Play-App-Signing-Schlüssel**, Apple-App-ID) liefert das Ortsfunk-Projekt an den Betreiber der ReparierBar (Umgebungsvariablen in `.env`).
- Verhalten beim Öffnen eines Links:
  - `#t=…`: Nummer und Schlüssel im Secure Storage ablegen (falls neu), Auftragsansicht öffnen.
  - `#v=…&aktion=annehmen|ablehnen`: Bestätigungsdialog, dann `POST /gast/auftrag/vorschlag/annehmen|ablehnen` mit Body `{ "nummer": "<nummer>", "token": "<v-Wert>" }`.
  - `#n=…`: Erklärung „Jemand hat Ihre Adresse angegeben“, Button „Das war ich nicht“ → `POST /gast/das-war-ich-nicht` mit `{ "nummer", "token" }`. Das storniert den Auftrag, löscht die Kontaktdaten und sperrt die Adresse.
  - Ist die App nicht installiert, öffnet der Link die Web-Seite (kommt mit dem Web-Frontend; bis dahin zeigt die Seite einen Hinweis).

### 4.7 Einwilligung, Impressum, Datenschutz
- Beim Start des Repair-Café-Bereichs `GET /globals/einstellungen` laden und für die Sitzung cachen (Neuladen beim Öffnen des Bereichs).
- **Einwilligung:** Sobald Kontaktdaten eingegeben werden, erscheint eine nicht vorangekreuzte Checkbox mit dem Text `einwilligungstext` (Markdown/Klartext, **unverändert** anzeigen, nicht umformulieren) und einem Link „Datenschutzhinweise“.
  Ohne Haken lässt sich das Formular mit Kontaktdaten nicht absenden. Gesendet wird `einwilligung: true`. Der Server speichert Zeitpunkt und eine Kennung der Textversion (`einwilligungVersion`).
- **Impressum / Datenschutz:** erreichbar im Repair-Café-Menü und im Anmeldeformular. Regel pro Text: Ist `impressumUrl` bzw. `datenschutzUrl` gesetzt, diese URL im Browser öffnen;
  sonst den Markdown-Text `impressum` bzw. `datenschutz` in der App rendern (z. B. `flutter_markdown`; **kein rohes HTML, Links nur `http(s)`, `mailto`, `tel`**). Fehlt beides: „Noch nicht hinterlegt“ und Link zur Webseite `webseiteUrl`, falls vorhanden.
- Die App muss zusätzlich ihr eigenes Impressum/ihre Datenschutzerklärung (Ortsfunk) behalten; die ReparierBar-Texte ergänzen sie nur im Repair-Café-Bereich.

### 4.8 Reparista: Anmeldung
- In **Einstellungen** der App neuer Eintrag „Repair Café – Anmeldung für Ehrenamtliche“: Formular E-Mail + Passwort → `POST /benutzer/login`. Nach 5 Fehlversuchen 10 Minuten gesperrt (Meldung des Servers anzeigen).
- Token (JWT, 12 Stunden gültig) im Secure Storage halten, Header `Authorization: JWT <token>`. Beim App-Start `GET /benutzer/me`; ist `user` null oder kommt 401, abmelden und Login zeigen.
  Vor Ablauf (z. B. bei Resume, wenn weniger als 2 Stunden übrig sind; `exp` aus Login/`me`) `POST /benutzer/refresh-token`.
- „Passwort vergessen“: `POST /benutzer/forgot-password` (Antwort immer gleich); Zurücksetzen geschieht per Mail-Link im Web, nicht in der App.
- Abmelden: `POST /benutzer/logout`, Token lokal löschen.
- Passwort nie speichern, nur das Token. Die Reparista-Bereiche sind nur sichtbar, wenn angemeldet; Gäste sehen davon nichts.

### 4.9 Reparista: Auftragsübersicht
- Auswahl der Veranstaltung (Standard: nächste), Liste `GET /auftraege?where[veranstaltung][equals]=<id>&limit=200&depth=0&sort=terminAnkunft`.
- Filter: Alle · Offen (`EINGEGANGEN`, `GEGENVORSCHLAG`) · Meine (`verantwortlich == me.id`) · Vertretung gesucht (`vertretungGesucht`).
- Zeile: Nummer, Kategorie/Hersteller/Typ, Zeit (`terminAnkunft` sonst `wunschAnkunft`), Status-Chip, Verantwortlicher.
- Detail: `GET /auftraege/{id}?depth=0` plus Notizen `GET /notizen?where[auftrag][equals]=<id>&sort=createdAt` und Historie `GET /ereignisse?where[auftrag][equals]=<id>&sort=zeitpunkt`.
  Fotos über `GET /bilder?where[auftrag][equals]=<id>` und `GET /bilder/file/<dateiname>` (Vorschau-Größe `sizes.vorschau`), Header `Authorization`.
- `kontakt` ist **nur für den Verantwortlichen (und Admins)** gefüllt. Fehlt es, kein Kontaktbereich zeigen. `emailVorhanden` sagt, ob eine Mail-Adresse hinterlegt ist.
- **Tagesliste:** `GET /veranstaltungen/{id}/tagesliste` – alle Geräte des Tages nach Ankunft, mit Notizen. Taugt als Ansicht am Veranstaltungstag.

### 4.10 Reparista: Aktionen (Statuswechsel)
Alle Aktionen sind `POST`, Header `Authorization`. Antwort ist `AuftragKurz` oder `Ergebnisantwort` (`auftrag` + `warnungen[]`). `warnungen` (z. B. Überschneidung mit eigener Zusage) als Hinweis anzeigen; sie verhindern nichts.

| Aktion | Endpunkt | Body | Wirkung |
|---|---|---|---|
| Wunschzeit zusagen | `/auftraege/{id}/bestaetigen` | – | `BESTAETIGT`, man wird Verantwortlicher. Der Erste gewinnt, sonst 409 |
| Gegenvorschlag | `/auftraege/{id}/gegenvorschlag` | `{ "ankunft": "HH:mm" }` | `GEGENVORSCHLAG`, man wird Verantwortlicher, Gast bekommt Mail. Nur mit E-Mail des Gastes |
| Termin ändern | `/auftraege/{id}/termin` | `{ "ankunft": "HH:mm", "grund": "…" }` (Grund Pflicht, max. 500) | jeder Reparista darf; Verantwortung bleibt |
| Übernehmen (ohne Termin) | `/auftraege/{id}/uebernehmen` | – | `UEBERNOMMEN` |
| Abgeben | `/auftraege/{id}/abgeben` | – | Verantwortung abgeben; bei bestätigtem Termin „Vertretung gesucht“ |
| Abschließen | `/auftraege/{id}/abschliessen` | `{ "ergebnis": "REPARIERT\|TEILWEISE\|NICHT_REPARIERBAR\|NICHT_ERSCHIENEN" }` | `ERLEDIGT` |
| Stornieren | `/auftraege/{id}/stornieren` | optional `{ "grund": "…" }` | `STORNIERT` |
| Telefonische Anmeldung | `POST /auftraege/telefon` | Schema `TelefonAnfrage` | legt Auftrag an; optional gleich bestätigter Termin; liefert `schluessel` für den Gast |

Genaue Bodies und Antworten: OpenAPI. 409 immer mit „Jemand war schneller“-Dialog, danach Detail neu laden.
Telefonische Anmeldung ohne E-Mail: der Gast kann nur mündlich informiert werden; den `schluessel` aus der Antwort dem Gast nur mitteilen, wenn er ihn braucht.
- Notiz: `POST /notizen` `{ "auftrag": <id>, "text": "…" }` (max. 4000 Zeichen).
- Der Statusverlauf (`/ereignisse`) ist nur lesbar.

## 5. Technische Vorgaben (Flutter)

- API-Client aus `openapi/openapi.yaml` generieren (z. B. `openapi_generator` mit `dart-dio`) oder per Hand mit `dio`. Eine Schicht `ReparierBarApi`, die Interceptors für `Authorization` und `X-Auftrag-Schluessel` setzt und Fehler in eine eigene `ApiFehler`-Klasse (Status + deutsche `message`) übersetzt.
- Secure Storage: Gast-Schlüssel (Map Nummer → Schlüssel), JWT. Nichts davon in `SharedPreferences`, Logs oder Backups (Android `allowBackup` für diese Daten ausschließen, bzw. Keystore-gebundene Speicherung).
- Kein Logging von Header, Token, Link-Fragmenten, Kontaktdaten, auch nicht in Debug-Builds mit Netzwerk-Interceptor (Header maskieren).
- Zeiten: Zeitzone `Europe/Berlin`, Anzeige `HH:mm`, Datum deutsch (`intl`, Locale `de`).
- Barrierefreiheit: Statusfarben nie allein, immer mit Text/Symbol; Mindestgrößen wie im Rest der App.
- Theming: Primär-/Akzent-/Textfarbe aus `einstellungen.farbePrimaer|farbeAkzent|farbeText` **nur im Repair-Café-Bereich** anwenden (Fallback: Ortsfunk-Theme bei ungültigem Hex). Logo aus `logoUrl` (SVG oder PNG), Fallback: Icon.
- Offline: Beim Verbindungsfehler Meldung „Keine Verbindung“ und Wiederholen-Button; gespeicherte Anmeldungen bleiben sichtbar (letzter bekannter Stand mit Zeitstempel). Absenden der Anmeldung nicht offline puffern.
- Mehrfachabsenden verhindern (Button sperren, solange die Anfrage läuft).
- Konfiguration: Basis-URL der ReparierBar als Build-Konstante/`--dart-define`.

## 6. Datenschutz (Vorgaben an die App)

- Datensparsamkeit: nur Felder erfassen, die das Formular nennt. Keine Gerätekennungen, kein Tracking, keine Analytics-Ereignisse mit Inhalten des Bereichs.
- Einwilligung wie 4.7, ohne vorangekreuzte Box; der Text kommt vom Server.
- Persönliche Links und Schlüssel sind Zugangsdaten: nicht teilen, nicht in Screenshots/Logs. Im UI ein Hinweis „Mit diesem Link kann jeder Ihre Anmeldung sehen“ bei „Link teilen“-Funktionen, oder die Funktion weglassen.
- Löschung: „Zurückziehen“ (4.5) storniert; die Kontaktdaten werden serverseitig nach der Löschfrist (`loeschfristMonate`) anonymisiert. In der App einen Satz dazu anzeigen (Wert aus den Einstellungen).
- Datenschutzvorlage für den Betreiber: `docs/Datenschutz-Vorlage.md`.

## 7. Fehlerfälle (Auswahl)

| Situation | Verhalten |
|---|---|
| 401 bei Gast-Aufruf | Schlüssel ungültig/Auftrag gelöscht → Eintrag als „nicht mehr verfügbar“ markieren, Löschen anbieten |
| 401 bei Reparista-Aufruf | abmelden, Login zeigen |
| 403 | „Dafür fehlen die Rechte“ |
| 409 | „Der Stand hat sich inzwischen geändert“, Daten neu laden |
| 422 | `message` anzeigen (z. B. Zeit nicht im Raster, Wunschzeit ohne E-Mail, max. 3 Bilder) |
| 429 | `message` anzeigen, später erneut versuchen |
| Netzfehler | siehe Offline |

## 8. Abnahmekriterien

1. Gast ohne Konto meldet ein Gerät mit 2 Fotos, ohne Kontaktdaten an, sieht den Auftrag unter „Meine Anmeldungen“ und kann ihn zurückziehen.
2. Anmeldung mit E-Mail und Wunschzeit funktioniert nur mit angehakter Einwilligung; der Text entspricht dem Server. Ohne E-Mail wird die Wunschzeit abgelehnt (Hinweis im Formular).
3. Bestätigungsmail → Link öffnet die App direkt im Auftrag (Android und iOS). Gegenvorschlag-Link und „Das war ich nicht“-Link funktionieren.
4. Reparista meldet sich an, bestätigt einen Auftrag; ein zweiter Reparista erhält bei gleichzeitiger Aktion 409 und eine verständliche Meldung.
5. Kontaktdaten sind für Nicht-Verantwortliche nicht sichtbar.
6. Name, Farben, Logo ändern sich, wenn der Admin die Einstellungen ändert, ohne App-Update.
7. Impressum und Datenschutz werden angezeigt (Text oder externe URL).
8. In keinem Log und keinem Crash-Report tauchen Schlüssel, Token, Passwörter oder Kontaktdaten auf.
9. Widget-/Unit-Tests für Zeitumrechnung (Sommer-/Winterzeit), Fehlerabbildung, Link-Parser (`#t=`, `#v=`, `#n=`).

## 9. Offene Punkte für das Ortsfunk-Projekt

- Verknüpfung Directus-Event ↔ ReparierBar-Veranstaltung (nur Hinweis-Text oder echte Kopplung?). Vorschlag: zunächst nur Hinweis auf feste Termine, Auswahl immer aus der ReparierBar.
- Paketname/Signatur für App Links an den Betreiber der ReparierBar liefern (siehe 4.6).
- Push-Benachrichtigungen sind nicht vorgesehen; Rückmeldungen laufen per E-Mail.
