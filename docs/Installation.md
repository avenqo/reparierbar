# Installation auf einem Server (Docker)

Ziel: eine laufende Instanz unter einer eigenen Domain, z. B. `https://repaircafe.kremmener.info`.
Voraussetzungen: ein Linux-Server mit Docker (Compose v2), eine Domain, ein SMTP-Zugang für Mails (optional, aber für Rückmeldungen an Gäste nötig).

## 1. DNS

Beim Domainanbieter einen **A-Record** (und ggf. AAAA) für `repaircafe.kremmener.info` auf die öffentliche IP des Servers setzen.
Prüfen: `dig +short repaircafe.kremmener.info` zeigt die Server-IP. Erst danach Schritt 4, sonst scheitert das Zertifikat.

## 2. Code auf den Server

```bash
sudo mkdir -p /opt/reparierbar && sudo chown $USER /opt/reparierbar
git clone https://github.com/avenqo/reparierbar.git /opt/reparierbar
cd /opt/reparierbar
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
| `DOMAIN` | `repaircafe.kremmener.info` (nur für Caddy) |
| `INSTANZ_NAME` | Vorgabename, später im Admin-Panel änderbar |
| `MAIL_FROM`, `SMTP_*` | Zugang des Mail-Anbieters |
| `ANDROID_*`, `IOS_APP_ID` | später für App Links der Ortsfunk-App |

## 4. Starten – Variante A: Caddy im Compose (empfohlen, wenn 80/443 frei sind)

```bash
cd /opt/reparierbar
docker compose -f docker-compose.yml -f deploy/docker-compose.caddy.yml up -d --build
docker compose ps
docker compose logs -f backend
```

Caddy holt das Zertifikat automatisch. Firewall: Ports 80 und 443 offen lassen (`sudo ufw allow 80,443/tcp`).

### Variante B: vorhandener Reverse Proxy

Läuft auf dem Server schon nginx/Caddy/Traefik (z. B. wegen Directus), nur das Backend starten:

```bash
docker compose up -d --build
```

Der Dienst hört dann auf `127.0.0.1:3100`. Im Proxy die Domain dorthin weiterleiten, Beispiel: `deploy/nginx.conf.beispiel`
(Upload-Limit mindestens 25 MB, Header `Host` und `X-Forwarded-Proto` durchreichen; danach HTTPS z. B. mit `certbot --nginx`).
Bei Caddy: `repaircafe.kremmener.info { reverse_proxy 127.0.0.1:3100 }`.

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
  cd /opt/reparierbar && git pull
  docker compose -f docker-compose.yml -f deploy/docker-compose.caddy.yml up -d --build   # bei Variante B ohne zweite Datei
  ```

  Datenbank-Migrationen laufen beim Start automatisch. Vorher sichern.
- **Logs:** `docker compose logs -f backend`. Zeitgesteuerte Aufgaben (Erinnerungen 10:00, Löschung 03:30, Mail-Versand) laufen im Backend selbst, kein Cron nötig.
- **Neustart nach Reboot:** Container haben `restart: unless-stopped`.

## 8. Fehlersuche

| Symptom | Ursache |
|---|---|
| Zertifikat wird nicht ausgestellt | DNS zeigt noch nicht auf den Server, oder Port 80/443 belegt/gesperrt |
| Login im Admin klappt, danach sofort abgemeldet | `PUBLIC_URL` stimmt nicht mit der Adresse im Browser überein (http/https, Domain) |
| Fehler „CSRF“/„Origin“ bei Anfragen | dito, bzw. Web-Frontend-Domain fehlt in `CORS_ORIGINS` |
| Uploads schlagen fehl (413) | Upload-Limit im Reverse Proxy zu klein |
| Mails kommen nicht an | `SMTP_*`, `MAIL_FROM` (Absenderdomain, SPF/DKIM beim Mailanbieter) prüfen |
| Container startet nicht | `docker compose logs backend`; häufig fehlt `PAYLOAD_SECRET` |
