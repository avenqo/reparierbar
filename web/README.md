# web – Web-Frontend (geplant)

Hier entsteht das Web-Frontend für **Gäste** (Anmeldung, Belegung, „Meine Anfrage“ über den persönlichen Link) und **Reparistas/Admins** (Auftragsübersicht, Tagesliste, Statuswechsel).

Vorgaben:

- Spricht ausschließlich die REST-API des Backends an (Vertrag: [`../openapi/openapi.yaml`](../openapi/openapi.yaml), Standard-Endpunkte von Payload unter `/api/<collection>`). Keine Datenbankzugriffe, keine gemeinsame Laufzeit mit `backend/`.
- Name, Logo und Farben kommen zur Laufzeit aus `GET /api/globals/einstellungen`, damit jede Kommune ihr Erscheinungsbild im Admin-Panel setzt und nichts neu gebaut werden muss.
- Der persönliche Link `https://<domain>/a/<nummer>#t=<schluessel>` wird hier aufgelöst; der Schlüssel steht im Fragment und geht als Header `X-Auftrag-Schluessel` an die API.
- Gäste bleiben ohne Login und ohne Cookies; Reparistas melden sich über `/api/benutzer/login` an.

Die Technik ist noch offen (naheliegend: Next.js oder ein schlankes SPA-Framework). Das Backend ist so gebaut, dass dieses Projekt unabhängig davon entstehen kann; in `docker-compose.yml` ist ein `web`-Dienst vorbereitet.
