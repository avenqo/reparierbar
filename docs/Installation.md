# Installation auf einem Server (Docker)

Ziel: eine laufende Instanz unter einer eigenen Domain, z. B. `https://repaircafe.kremmener.info`.
Voraussetzungen: ein Linux-Server mit Docker (Compose v2) und nginx, eine Domain, ein SMTP-Zugang für Mails (optional, aber für Rückmeldungen an Gäste nötig).

## 1. DNS

Beim Domainanbieter einen **A-Record** (und ggf. AAAA) für `repaircafe.kremmener.info` auf die öffentliche IP des Servers setzen.
Prüfen: `dig +short repaircafe.kremmener.info` zeigt die Server-IP. Erst danach das Zertifikat (Schritt 4) holen, sonst scheitert es.

## 2. Code auf den Server

Beliebiges Verzeichnis, hier `<VERZEICHNIS>` genannt (der Pfad ist egal; alle Befehle laufen darin):

```bash
git clone https://github.com/avenqo/reparierbar.git <VERZEICHNIS>
cd <VERZEICHNIS>
```

(Ist das Repository privat, vorher einen Deploy-Key oder Token einrichten.)

## 3. Konfiguration

```bash
cp .env.example .env
# Zufallswert für PAYLOAD_SECRET erzeugen und eintragen:
openssl rand -base64 48
nano .env
```

Wichtig in `.env`:

| Variable | Wert |
|---|---|
| `PAYLOAD_SECRET` | langer Zufallswert. **Nie ändern und sichern:** daraus entstehen die Mail-Tokens, ein Wechsel entwertet alle Links |
| `PUBLIC_URL` | `https://repaircafe.kremmener.info` (steht in Mail-Links und steuert das Secure-Cookie) |
| `PORT` | optional, Host-Port für nginx (Vorgabe `3100`, nur auf `127.0.0.1`) |
| `INSTANZ_NAME` | Vorgabename, später im Admin-Panel änderbar |
| `MAIL_FROM`, `SMTP_*` | Zugang des Mail-Anbieters |
| `ANDROID_*`, `IOS_APP_ID` | später für App Links der Ortsfunk-App |

## 4. Starten und nginx einrichten

```bash
cd <VERZEICHNIS>
docker compose up -d --build
docker compose ps
docker compose logs -f backend
```

Der Dienst hört nur auf `127.0.0.1:3100` (nicht öffentlich). Dann nginx:

1. `deploy/nginx.conf.beispiel` nach `/etc/nginx/sites-available/repaircafe` kopieren, `server_name` und bei geändertem `PORT` den Port anpassen, nach `sites-enabled` verlinken.
   Wichtig: `client_max_body_size 25m;` (Foto-Uploads) und die Header `Host` und `X-Forwarded-Proto`.
2. `sudo nginx -t && sudo systemctl reload nginx`
3. HTTPS: `sudo certbot --nginx -d repaircafe.kremmener.info` (ergänzt den 443-Block und die Weiterleitung von http auf https).
4. Firewall: 80 und 443 offen.

## 5. Prüfen

```bash
curl -s https://repaircafe.kremmener.info/api/health
curl -s https://repaircafe.kremmener.info/api/globals/einstellungen | head -c 300
```

Dann im Browser `https://repaircafe.kremmener.info/admin` öffnen.

## 6. Erste Einrichtung

1. **Ersten Benutzer registrieren** (Formular erscheint beim ersten Aufruf von `/admin`). Er wird automatisch Admin. Das sollte sofort passieren, bevor jemand anderes die Seite findet.
2. **Einstellungen:** Name, Nummern-Präfix, Farben, Logo-URL, Standardzeiten (10:00–14:00, letzte Ankunft 13:00, Raster 15 min), Löschfrist.
3. **Rechtliches:** Impressum, Datenschutzhinweise (Vorlage: `docs/Datenschutz-Vorlage.md`) und Einwilligungstext eintragen. Prüfen: `/impressum` und `/datenschutz`.
4. **Gerätekategorien** und **Veranstaltungen** (die festen Termine) anlegen.
5. **Reparistas** anlegen (Benutzer, Rolle „Reparista“).
6. **Mail testen:** Passwort-Reset für einen Benutzer auslösen oder eine Test-Anmeldung mit eigener Adresse machen. Kommt nichts an: `docker compose logs backend`, SMTP-Werte prüfen (Port 587 mit STARTTLS bzw. 465).

## 7. Betrieb

- **Daten:** alles liegt im Docker-Volume `reparierbar_daten` (SQLite unter `/data/db`, Bilder unter `/data/bilder`).
- **Datensicherung (täglich per Cron):**

  ```bash
  docker run --rm -v reparierbar_daten:/data -v /var/backups/reparierbar:/backup alpine \
    tar czf /backup/reparierbar-$(date +%F).tar.gz -C /data .
  ```

  Und `.env` (v. a. `PAYLOAD_SECRET`) getrennt sichern. Sicherungen enthalten Personendaten: verschlüsselt und nicht öffentlich ablegen.
- **Update:**

  ```bash
  cd <VERZEICHNIS> && git pull
  docker compose up -d --build
  ```

  Datenbank-Migrationen laufen beim Start automatisch. Vorher sichern.
- **Logs:** `docker compose logs -f backend`. Zeitgesteuerte Aufgaben (Erinnerungen 10:00, Löschung 03:30, Mail-Versand) laufen im Backend selbst, kein Cron nötig.
- **Neustart nach Reboot:** Container haben `restart: unless-stopped`.

## 8. Fehlersuche

| Symptom | Ursache |
|---|---|
| Zertifikat wird nicht ausgestellt | DNS zeigt noch nicht auf den Server, oder Port 80/443 gesperrt |
| Login im Admin klappt, danach sofort abgemeldet | `PUBLIC_URL` stimmt nicht mit der Adresse im Browser überein (http/https, Domain) |
| Fehler „CSRF“/„Origin“ bei Anfragen | dito, bzw. Web-Frontend-Domain fehlt in `CORS_ORIGINS` |
| Uploads schlagen fehl (413) | `client_max_body_size` in nginx zu klein |
| Mails kommen nicht an | `SMTP_*`, `MAIL_FROM` (Absenderdomain, SPF/DKIM beim Mailanbieter) prüfen |
| Container startet nicht | `docker compose logs backend`; häufig fehlt `PAYLOAD_SECRET` |
