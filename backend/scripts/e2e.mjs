// Rauchtest gegen ein laufendes Backend:  BASE=http://localhost:3000 PAYLOAD_SECRET=… node scripts/e2e.mjs
// Erwartet eine frische Datenbank (der erste Benutzer wird Admin).
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import sharp from 'sharp'

const BASE = process.env.BASE || 'http://localhost:3000'
const SECRET = process.env.PAYLOAD_SECRET
assert(SECRET, 'PAYLOAD_SECRET setzen (für Mail-Aktions-Tokens)')
const aktionsToken = (zweck, id) => createHmac('sha256', SECRET).update(`${zweck}:${id}`).digest('base64url')

let schritte = 0
const ok = (text) => console.log(`✓ ${++schritte}. ${text}`)

async function api(pfad, { method = 'GET', body, jwt, schluessel, form } = {}) {
  const headers = {}
  if (jwt) headers.Authorization = `JWT ${jwt}`
  if (schluessel) headers['X-Auftrag-Schluessel'] = schluessel
  if (body) headers['Content-Type'] = 'application/json'
  const res = await fetch(`${BASE}/api${pfad}`, { method, headers, body: form ?? (body ? JSON.stringify(body) : undefined) })
  const text = await res.text()
  let daten
  try { daten = JSON.parse(text) } catch { daten = text }
  return { status: res.status, daten, res }
}
const erwarte = (r, status, was) => assert.equal(r.status, status, `${was}: erwartet ${status}, bekam ${r.status} ${JSON.stringify(r.daten).slice(0, 300)}`)

// --- Benutzer ---
let r = await api('/benutzer/first-register', { method: 'POST', body: { email: 'admin@test.de', password: 'Passwort-123', 'confirm-password': 'Passwort-123', name: 'Admin', rolle: 'REPARISTA', aktiv: false, fachgebiete: [] } }) // wie das Formular im Admin-Panel
erwarte(r, 200, 'first-register')
r = await api('/benutzer/login', { method: 'POST', body: { email: 'admin@test.de', password: 'Passwort-123' } })
erwarte(r, 200, 'login')
const admin = r.daten.token
assert.equal(r.daten.user.rolle, 'ADMIN'); assert.equal(r.daten.user.aktiv, true)
ok('erster Benutzer ist Admin und kann sich anmelden')

r = await api('/benutzer', { method: 'POST', jwt: admin, body: { email: 'anna@test.de', password: 'Passwort-123', name: 'Anna', rolle: 'REPARISTA' } })
erwarte(r, 201, 'Reparista Anna')
r = await api('/benutzer', { method: 'POST', jwt: admin, body: { email: 'ben@test.de', password: 'Passwort-123', name: 'Ben', rolle: 'REPARISTA' } })
erwarte(r, 201, 'Reparista Ben')
const login = async (email) => (await api('/benutzer/login', { method: 'POST', body: { email, password: 'Passwort-123' } })).daten
const anna = (await login('anna@test.de')); const ben = (await login('ben@test.de'))
ok('Reparistas angelegt')

// --- Veranstaltung mit Standardzeiten ---
const tag = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10)
r = await api('/veranstaltungen', { method: 'POST', jwt: admin, body: { datum: `${tag}T12:00:00.000Z`, ort: 'Gemeindehaus' } })
erwarte(r, 201, 'Veranstaltung')
const v = r.daten.doc
assert.deepEqual([v.beginn, v.ende, v.letzteAnkunft, v.rasterMinuten], ['10:00', '14:00', '13:00', 15])
ok('Veranstaltung übernimmt die Standardzeiten (10:00–14:00, letzte Ankunft 13:00, Raster 15)')

const kat = (await api('/geraetekategorien')).daten.docs[0].id
const anfrage = (extra = {}) => ({ geraetekategorie: kat, hersteller: 'Philips', typ: 'HD1234', fehlerbeschreibung: 'Kaffeemaschine heizt nicht', veranstaltung: v.id, ...extra })

// --- Gast ---
r = await api('/gast/anfrage', { method: 'POST', body: anfrage({ wunschAnkunft: '10:30' }) })
erwarte(r, 422, 'Wunschzeit ohne E-Mail')
r = await api('/gast/anfrage', { method: 'POST', body: anfrage({ wunschAnkunft: '10:30', kontakt: { email: 'gast@test.de', name: 'Gabi' } }) })
erwarte(r, 422, 'Kontakt ohne Einwilligung')
r = await api('/gast/anfrage', { method: 'POST', body: anfrage({ wunschAnkunft: '13:15', kontakt: { email: 'gast@test.de' }, einwilligung: true }) })
erwarte(r, 422, 'Ankunft nach letzter Ankunft')
r = await api('/gast/anfrage', { method: 'POST', body: anfrage({ wunschAnkunft: '10:30', kontakt: { email: 'gast@test.de', name: 'Gabi' }, einwilligung: true }) })
erwarte(r, 201, 'Gast-Anfrage')
const g1 = r.daten
assert.match(g1.nummer, /^RC-\d{4}-0001$/)
r = await api('/gast/anfrage', { method: 'POST', body: anfrage({ hersteller: 'Bosch', typ: 'Bohrer' }) })
erwarte(r, 201, 'Gast-Anfrage ohne E-Mail')
const g2 = r.daten
ok(`Gast-Anfragen angelegt (${g1.nummer} mit, ${g2.nummer} ohne Reservierung)`)

r = await api('/gast/auftrag')
erwarte(r, 401, 'ohne Schlüssel')
r = await api('/gast/auftrag', { schluessel: g1.schluessel })
erwarte(r, 200, 'Gast liest Auftrag')
assert.equal(r.daten.wunschAnkunft, '10:30'); assert.equal(r.daten.kontakt.email, 'gast@test.de')
r = await api('/gast/auftrag', { method: 'PATCH', schluessel: g1.schluessel, body: { fehlerbeschreibung: 'Heizt nicht, Wasser tropft', kontakt: { telefon: '0151 123' } } })
erwarte(r, 200, 'Gast ergänzt')
ok('Gast sieht und ergänzt nur mit persönlichem Schlüssel')

// Bilder
const png = await sharp({ create: { width: 2400, height: 1800, channels: 3, background: '#c33' } }).png().toBuffer()
const hochladen = () => { const f = new FormData(); f.append('file', new Blob([png], { type: 'image/png' }), 'foto.png'); return api('/gast/auftrag/bilder', { method: 'POST', schluessel: g1.schluessel, form: f }) }
const bilder = []
for (let i = 0; i < 3; i++) { r = await hochladen(); erwarte(r, 201, `Bild ${i + 1}`); bilder.push(r.daten.id) }
r = await hochladen(); erwarte(r, 422, 'viertes Bild')
r = await fetch(`${BASE}/api/gast/auftrag/bilder/${bilder[0]}`, { headers: { 'X-Auftrag-Schluessel': g1.schluessel } })
assert.equal(r.status, 200); const bild = Buffer.from(await r.arrayBuffer()); const meta = await sharp(bild).metadata(); assert(meta.width <= 400)
r = await fetch(`${BASE}/api/gast/auftrag/bilder/${bilder[0]}?groesse=original`, { headers: { 'X-Auftrag-Schluessel': g1.schluessel } })
const orig = await sharp(Buffer.from(await r.arrayBuffer())).metadata(); assert(orig.width <= 1600 && orig.format === 'jpeg')
r = await api(`/bilder/file/x.jpg`); assert([401, 403, 404].includes(r.status), 'Bilddatei nicht öffentlich')
r = await api(`/gast/auftrag/bilder?id=${bilder[2]}`, { method: 'DELETE', schluessel: g1.schluessel }); erwarte(r, 200, 'Bild löschen')
ok('Bilder: max. 3, auf 1600 px/JPEG verkleinert, Vorschau 400 px, Löschen, nicht öffentlich')

// --- Öffentliche Belegung ---
r = await api(`/veranstaltungen/${v.id}/belegung`)
erwarte(r, 200, 'Belegung')
const txt = JSON.stringify(r.daten)
assert(!txt.includes('Gabi') && !txt.includes('gast@test.de') && !txt.includes('tropft'), 'keine Personendaten in der Belegung')
assert.equal(r.daten.belegung.length, 1) // nur die Anfrage mit Wunschzeit
ok('Belegung öffentlich, ohne Personendaten')

// --- Reparistas ---
r = await api(`/auftraege/${g1.nummer ? '' : ''}0/bestaetigen`, { method: 'POST', jwt: anna.token }); assert.notEqual(r.status, 200)
const liste = await api('/auftraege?sort=nummer&limit=10', { jwt: anna.token }); erwarte(liste, 200, 'Liste')
const a1 = liste.daten.docs.find((d) => d.nummer === g1.nummer); const a2 = liste.daten.docs.find((d) => d.nummer === g2.nummer)
assert(!a1.kontakt, 'Kontakt für Nicht-Verantwortliche verborgen'); assert.equal(a1.emailVorhanden, true)
assert(!JSON.stringify(a1).includes('linkSchluesselHash'))
r = await api(`/auftraege/${a1.id}/bestaetigen`, { method: 'POST', jwt: anna.token }); erwarte(r, 200, 'Anna bestätigt')
assert.equal(r.daten.auftrag.status, 'BESTAETIGT'); assert.equal(r.daten.auftrag.terminAnkunft, '10:30')
r = await api(`/auftraege/${a1.id}/bestaetigen`, { method: 'POST', jwt: ben.token }); erwarte(r, 409, 'Ben bestätigt zu spät')
r = await api(`/auftraege/${a1.id}`, { jwt: anna.token }); assert.equal(r.daten.kontakt?.email, 'gast@test.de', 'Verantwortliche sieht Kontakt')
r = await api(`/auftraege/${a1.id}`, { jwt: ben.token }); assert(!r.daten.kontakt?.email, 'Ben sieht keinen Kontakt')
r = await api(`/auftraege/${a1.id}`, { jwt: admin }); assert.equal(r.daten.kontakt?.email, 'gast@test.de', 'Admin sieht Kontakt')
ok('Bestätigen: erster gewinnt (409 für den zweiten), Kontaktdaten nur für Verantwortliche und Admin')

r = await api(`/auftraege/${a1.id}`, { method: 'PATCH', jwt: ben.token, body: { status: 'ERLEDIGT' } }); assert.notEqual(r.status, 200, 'Status nicht über Standard-API änderbar')
r = await api(`/auftraege/${a1.id}`, { method: 'PATCH', jwt: admin, body: { status: 'ERLEDIGT', terminAnkunft: new Date().toISOString() } })
r = await api(`/auftraege/${a1.id}`, { jwt: admin }); assert.equal(r.daten.status, 'BESTAETIGT', 'Status blieb unverändert')
ok('Statusfeld und Termine sind über die Standard-API nicht beschreibbar')

r = await api(`/auftraege/${a1.id}/termin`, { method: 'POST', jwt: ben.token, body: { ankunft: '11:00' } }); erwarte(r, 400, 'Grund fehlt')
r = await api(`/auftraege/${a1.id}/termin`, { method: 'POST', jwt: ben.token, body: { ankunft: '11:00', grund: 'Reparista krank' } }); erwarte(r, 200, 'Termin ändern')
assert.equal(r.daten.auftrag.verantwortlich, anna.user.id, 'Verantwortung bleibt bei Anna')
r = await api(`/auftraege/${a1.id}/termin`, { method: 'POST', jwt: ben.token, body: { ankunft: '11:10', grund: 'x' } }); erwarte(r, 422, 'Raster')
ok('Termin ändern durch beliebigen Reparista, Verantwortung bleibt, Raster geprüft')

// Gegenvorschlag
const gv = await api('/gast/anfrage', { method: 'POST', body: anfrage({ wunschAnkunft: '10:00', kontakt: { email: 'zweite@test.de' }, einwilligung: true }) }); erwarte(gv, 201, 'dritte Anfrage')
const idGv = (await api('/auftraege?where[nummer][equals]=' + gv.daten.nummer, { jwt: ben.token })).daten.docs[0].id
r = await api(`/auftraege/${a2.id}/gegenvorschlag`, { method: 'POST', jwt: ben.token, body: { ankunft: '12:00' } }); erwarte(r, 422, 'Gegenvorschlag ohne E-Mail')
r = await api(`/auftraege/${idGv}/gegenvorschlag`, { method: 'POST', jwt: ben.token, body: { ankunft: '12:00' } }); erwarte(r, 200, 'Gegenvorschlag')
assert.equal(r.daten.auftrag.status, 'GEGENVORSCHLAG')
r = await api('/gast/auftrag/vorschlag/annehmen', { method: 'POST', body: { nummer: gv.daten.nummer, token: 'falsch' } }); erwarte(r, 401, 'falscher Token')
r = await api('/gast/auftrag/vorschlag/annehmen', { method: 'POST', schluessel: gv.daten.schluessel, body: {} }); erwarte(r, 200, 'Gast nimmt an')
assert.equal(r.daten.status, 'BESTAETIGT'); assert.equal(r.daten.terminAnkunft, '12:00')
ok('Gegenvorschlag: nur mit E-Mail, Gast kann annehmen')

const gv2 = await api('/gast/anfrage', { method: 'POST', body: anfrage({ wunschAnkunft: '12:00', kontakt: { email: 'dritte@test.de' }, einwilligung: true }) })
const idGv2 = (await api('/auftraege?where[nummer][equals]=' + gv2.daten.nummer, { jwt: ben.token })).daten.docs[0].id
await api(`/auftraege/${idGv2}/gegenvorschlag`, { method: 'POST', jwt: ben.token, body: { ankunft: '12:30' } })
const zweck = `vorschlag:${(await api(`/auftraege/${idGv2}`, { jwt: admin })).daten.vorschlagAnkunft}`
r = await api('/gast/auftrag/vorschlag/ablehnen', { method: 'POST', body: { nummer: gv2.daten.nummer, token: aktionsToken(zweck, idGv2) } }); erwarte(r, 200, 'Gast lehnt per Mail-Token ab')
assert.equal(r.daten.status, 'EINGEGANGEN'); assert.equal(r.daten.verantwortlich, null)
ok('Gegenvorschlag ablehnen per Mail-Token: Auftrag wieder offen, Verantwortung entfällt')

// Übernehmen / Abgeben / Abschließen
r = await api(`/auftraege/${a2.id}/uebernehmen`, { method: 'POST', jwt: ben.token }); erwarte(r, 200, 'ohne Termin übernehmen')
r = await api(`/auftraege/${a2.id}/abgeben`, { method: 'POST', jwt: anna.token }); erwarte(r, 403, 'fremde Verantwortung abgeben')
r = await api(`/auftraege/${a2.id}/abschliessen`, { method: 'POST', jwt: ben.token, body: { ergebnis: 'REPARIERT' } }); erwarte(r, 200, 'abschließen')
r = await api(`/auftraege/${a1.id}/abgeben`, { method: 'POST', jwt: anna.token }); erwarte(r, 200, 'Termin abgeben')
assert.equal(r.daten.auftrag.vertretungGesucht, true); assert.equal(r.daten.auftrag.status, 'BESTAETIGT')
r = await api(`/auftraege/${a1.id}/uebernehmen`, { method: 'POST', jwt: ben.token }); erwarte(r, 200, 'Vertretung übernehmen')
ok('Übernehmen, Abgeben („Vertretung gesucht“), Vertretung, Abschließen')

// Überschneidung (Ben hat 11:00 und bekommt 11:30)
const ue = await api('/auftraege/telefon', { method: 'POST', jwt: ben.token, body: anfrage({ terminAnkunft: '11:30', kontakt: { name: 'Herr Telefon' }, einwilligung: true }) })
erwarte(ue, 201, 'Telefonische Anmeldung'); assert.equal(ue.daten.status, 'BESTAETIGT'); assert.equal(ue.daten.warnungen.length, 1, 'Überschneidungswarnung')
ok('Telefonische Anmeldung mit bestätigtem Termin ohne E-Mail; Überschneidung warnt')

// Notizen + Historie + Tagesliste
r = await api('/notizen', { method: 'POST', jwt: anna.token, body: { auftrag: a1.id, text: 'Heizelement prüfen', link: 'https://example.org/anleitung' } }); erwarte(r, 201, 'Notiz')
r = await api('/notizen', { method: 'POST', jwt: anna.token, body: { auftrag: a1.id, text: 'x', link: 'javascript:alert(1)' } }); erwarte(r, 400, 'Link-Validierung')
r = await api('/notizen?limit=5'); assert.notEqual(r.status, 200, 'Notizen nicht öffentlich')
r = await api(`/ereignisse?where[auftrag][equals]=${a1.id}&sort=zeitpunkt&depth=0`, { jwt: anna.token }); erwarte(r, 200, 'Historie')
assert(r.daten.docs.length >= 5); assert(!JSON.stringify(r.daten).includes('gast@test.de'), 'Historie ohne Kontakt-Klartext')
r = await api('/ereignisse', { method: 'POST', jwt: admin, body: { auftrag: a1.id, akteurTyp: 'SYSTEM', aktion: 'x' } }); assert.notEqual(r.status, 201, 'Historie nicht beschreibbar')
r = await api(`/veranstaltungen/${v.id}/tagesliste`, { jwt: ben.token }); erwarte(r, 200, 'Tagesliste')
assert(r.daten.auftraege.length >= 4); r = await api(`/veranstaltungen/${v.id}/tagesliste`); erwarte(r, 401, 'Tagesliste ohne Login')
ok('Notizen, Historie (ohne Klartext, nur lesbar), Tagesliste')

// Stornieren, "Das war ich nicht"
const st = await api('/gast/anfrage', { method: 'POST', body: anfrage({ kontakt: { email: 'fremd@test.de' }, einwilligung: true }) })
const idSt = (await api('/auftraege?where[nummer][equals]=' + st.daten.nummer, { jwt: admin })).daten.docs[0].id
r = await api('/gast/das-war-ich-nicht', { method: 'POST', body: { nummer: st.daten.nummer, token: aktionsToken('nicht-ich', idSt) } }); erwarte(r, 200, 'Das war ich nicht')
r = await api(`/auftraege/${idSt}`, { jwt: admin }); assert.equal(r.daten.status, 'STORNIERT'); assert(!r.daten.kontakt?.email)
r = await api('/gast/anfrage', { method: 'POST', body: anfrage({ kontakt: { email: 'FREMD@test.de' }, einwilligung: true }) }); erwarte(r, 403, 'gesperrte Adresse')
const gs = await api('/gast/anfrage', { method: 'POST', body: anfrage() })
r = await api('/gast/auftrag/stornieren', { method: 'POST', schluessel: gs.daten.schluessel }); erwarte(r, 200, 'Gast storniert')
r = await api('/gast/auftrag/stornieren', { method: 'POST', schluessel: gs.daten.schluessel }); erwarte(r, 409, 'doppelt stornieren')
ok('„Das war ich nicht“ storniert, löscht Kontakt und sperrt die Adresse; Gast kann stornieren')

// Rate-Limit je E-Mail
let limit
for (let i = 0; i < 6; i++) { limit = await api('/gast/anfrage', { method: 'POST', body: anfrage({ kontakt: { email: 'viel@test.de' }, einwilligung: true }) }) }
erwarte(limit, 429, 'Limit je E-Mail')
ok('Limit je E-Mail-Adresse (429)')

// Jobs / Mails
r = await api('/payload-jobs/run?queue=default', { method: 'GET', jwt: admin }); erwarte(r, 200, 'Jobs laufen')
r = await api('/payload-jobs?where[hasError][equals]=true', { jwt: admin }); erwarte(r, 200, 'Job-Fehler')
assert.equal(r.daten.totalDocs, 0, 'keine fehlgeschlagenen Mail-Jobs: ' + JSON.stringify(r.daten.docs?.[0]?.error))
r = await api('/payload-jobs/run?queue=default', { jwt: ben.token }); assert.notEqual(r.status, 200, 'Jobs nur für Admins')
ok('Mail-Jobs laufen ohne Fehler')

// Admin
r = await api('/admin/bereinigung', { method: 'POST', jwt: ben.token, body: { vorDatum: '2100-01-01' } }); erwarte(r, 403, 'Bereinigung nur Admin')
r = await api('/admin/bereinigung', { method: 'POST', jwt: admin, body: { vorDatum: '2100-01-01' } }); erwarte(r, 200, 'dryRun'); assert.equal(r.daten.dryRun, true); const n = r.daten.anzahl; assert(n >= 5)
r = await api(`/auftraege/${a1.id}`, { jwt: admin }); erwarte(r, 200, 'noch vorhanden nach dryRun')
r = await api(`/auftraege/${a1.id}`, { method: 'DELETE', jwt: ben.token }); assert.notEqual(r.status, 200, 'Löschen nur Admin')
r = await api(`/auftraege/${a1.id}`, { method: 'DELETE', jwt: admin }); erwarte(r, 200, 'Admin löscht')
r = await api(`/bilder?where[auftrag][equals]=${a1.id}`, { jwt: admin }); assert.equal(r.daten.totalDocs, 0, 'Bilder mitgelöscht')
r = await api(`/notizen?where[auftrag][equals]=${a1.id}`, { jwt: admin }); assert.equal(r.daten.totalDocs, 0, 'Notizen mitgelöscht')
r = await api(`/ereignisse?where[auftrag][equals]=${a1.id}`, { jwt: admin }); assert.equal(r.daten.totalDocs, 0, 'Historie mitgelöscht')
r = await api('/admin/bereinigung', { method: 'POST', jwt: admin, body: { vorDatum: '2100-01-01', dryRun: false } }); erwarte(r, 200, 'Bereinigung')
r = await api('/auftraege?limit=1', { jwt: admin }); assert.equal(r.daten.totalDocs, 0)
ok('Admin: Bereinigung (dryRun/echt), Löschen räumt Bilder, Notizen und Historie ab')

// Einstellungen
r = await api('/globals/einstellungen'); erwarte(r, 200, 'Einstellungen öffentlich'); assert(r.daten.name)
r = await api('/globals/einstellungen', { method: 'POST', jwt: ben.token, body: { name: 'x' } }); assert.notEqual(r.status, 200, 'Einstellungen nur Admin')
r = await api('/globals/einstellungen', { method: 'POST', jwt: admin, body: { name: 'Repair Café Neustadt', nummernPraefix: 'RN', farbePrimaer: '#123456' } }); erwarte(r, 200, 'Einstellungen ändern')
const n2 = await api('/gast/anfrage', { method: 'POST', body: anfrage() }); erwarte(n2, 201, 'Anfrage mit neuem Präfix'); assert.match(n2.daten.nummer, /^RN-\d{4}-0001$/)
ok('Einstellungen: öffentlich lesbar, nur Admin ändert, Präfix wirkt auf neue Nummern')

// --- Rechtliches ---
r = await fetch(`${BASE}/impressum`); assert.equal(r.status, 200); assert((await r.text()).includes('noch nicht hinterlegt'), 'Impressum ohne Text: Hinweis')
r = await api('/globals/einstellungen', { method: 'POST', jwt: admin, body: { impressum: '# Impressum\n\nMax Muster, **Kremmen**\n\n<script>alert(1)</script>', datenschutz: 'Wir speichern Kontaktdaten.\n\n[x](javascript:alert(1))', einwilligungstext: 'Ich willige ein (Test).' } }); erwarte(r, 200, 'Rechtstexte speichern')
r = await api('/globals/einstellungen'); assert.equal(r.daten.einwilligungstext, 'Ich willige ein (Test).'); assert(r.daten.impressum.includes('Max Muster'), 'Texte öffentlich lesbar')
let html = await (await fetch(`${BASE}/impressum`)).text()
assert(html.includes('<strong>Kremmen</strong>') && !html.includes('<script>alert'), 'Markdown gerendert, HTML maskiert')
html = await (await fetch(`${BASE}/datenschutz`)).text(); assert(!html.includes('javascript:'), 'unsichere Links entfernt')
html = await (await fetch(`${BASE}/admin/login`)).text(); assert(html.includes('/impressum') && html.includes('/datenschutz'), 'Admin-Anmeldeseite verlinkt Impressum und Datenschutz')
const c1 = await api('/gast/anfrage', { method: 'POST', body: anfrage({ kontakt: { name: 'Version' }, einwilligung: true }) }); erwarte(c1, 201, 'Anfrage nach Textänderung')
const cid = (await api('/auftraege?where[nummer][equals]=' + c1.daten.nummer, { jwt: admin })).daten.docs[0]
assert.match(cid.kontakt.einwilligungVersion, /^[0-9a-f]{8}$/, 'Version der Einwilligung gespeichert')
r = await fetch(`${BASE}/.well-known/assetlinks.json`); assert.equal(r.status, 404, 'App Links ohne Konfiguration: 404')
ok('Rechtliches: Texte in den Einstellungen, öffentliche Seiten, Admin-Links, Einwilligungs-Version am Auftrag')

console.log(`\nAlle ${schritte} Prüfungen bestanden.`)
