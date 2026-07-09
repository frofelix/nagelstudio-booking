# Nagelstudio Mitarbeiter-App

Mobile-first MVP fuer die Mitarbeiter-App eines Nagelstudio-Buchungssystems.

## Enthalten

- `/staff/calendar`: Tageskalender mit aktueller Woche, Tagesauswahl, Terminen und Plus-Button.
- `/staff/working-hours`: Wochenweise Arbeitszeiten Montag bis Samstag mit Bottom-Sheet-Zeitpicker.
- `/staff/bookings/new`: Manuelles Erstellen von Terminen mit serverseitiger Konfliktpruefung.
- `/admin`: Mobile Admin-App fuer Mitarbeiter, Rollen, Berechtigungen, Services, Urlaub und Termin-Uebersicht.
- `/login`: Login fuer Admins und Mitarbeiter mit signierter Session.
- API-Routen fuer Login, Logout, Termine, Arbeitszeiten, Services, Mitarbeiter, Urlaub und Admin-Uebersicht.
- Prisma-Datenmodell mit PostgreSQL, Mitarbeitern, Rollen, Urlaub, User-Basis und Seed-Daten.

Noch nicht enthalten: externer Auth-Provider, Kunden-Buchungswidget, Wix-Integration und Online-Zahlung.

## Setup

```bash
npm install
cp .env.example .env
```

Passe `DATABASE_URL` in `.env` an deine lokale PostgreSQL-Datenbank an.

## Datenbank

```bash
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run prisma:seed
```

Der Seed legt Demo-Mitarbeiter, Services, aktuelle Wochenarbeitszeiten und Beispieltermine fuer den heutigen Tag an. Die App verwendet im MVP fest `demo-lisa`.

## Admin und Berechtigungen

Der Admin-Bereich ist unter `http://localhost:3000/admin` erreichbar.

Aktuell gibt es drei Rollen:

- `owner`: Inhaber mit allen Rechten.
- `admin`: Verwaltungsperson fuer Team und Betrieb.
- `staff`: Mitarbeiterzugang fuer Kalender und Arbeitszeiten.

Die API ist schon auf echte Daten vorbereitet. Ohne `DATABASE_URL` zeigt die App Demo-Daten und lokale Fallbacks, damit die Oberflaeche weiter ausprobiert werden kann.

## Naechster echter Produktionsschritt

1. PostgreSQL-Datenbank anlegen, z.B. Supabase, Neon oder Vercel Postgres.
2. `DATABASE_URL` in `.env` eintragen.
3. `npm run prisma:migrate -- --name admin_foundation` ausfuehren.
4. `npm run prisma:seed` ausfuehren.
5. Danach Auth einbauen, z.B. Auth.js, Clerk oder Supabase Auth, und die Rollen aus `User`/`Employee` fuer Zugriffsschutz verwenden.

Aktuelles Supabase-Projekt:

- Project Ref: `rlmqdrptruibtlkketpo`
- Region: `eu-west-1`
- Direkte Prisma-Verbindung:
- Lokale Prisma-Verbindung ueber Supabase Transaction Pooler:

```env
DATABASE_URL="postgresql://postgres.rlmqdrptruibtlkketpo:DEIN_SUPABASE_DB_PASSWORT@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?schema=public&sslmode=require&pgbouncer=true"
AUTH_SECRET="BITTE_EIN_LANGES_RANDOM_SECRET_EINTRAGEN"
```

Das Datenbankschema wurde bereits als Supabase-Migration `admin_foundation` angelegt.

## Login und Rollen

Die App schuetzt `/admin` und die Admin-APIs serverseitig. Mitarbeiter ohne Admin-Rolle werden aus dem Admin-Bereich zur Mitarbeiter-App weitergeleitet.

Admins koennen im Team-Bereich einen Zugang fuer Mitarbeiter erstellen oder das Passwort zuruecksetzen. Dabei wird ein neues Startpasswort generiert, nur einmal im Admin-Sheet angezeigt und als Scrypt-Hash in Supabase gespeichert.

Mitarbeiter koennen ihr Passwort unter `/account/password` selbst aendern. In der Mitarbeiter-App fuehrt das Konto-Icon oben rechts zu dieser Seite.

Start-Zugaenge fuer die Entwicklung:

- Owner: `lisa@nailstudio.test` / `Admin2026!`
- Mitarbeiter: `sarah@nailstudio.test` / `Mitarbeiter2026!`

Passwoerter werden in der Datenbank als Scrypt-Hash gespeichert. Fuer Produktion sollten Mitarbeiter spaeter ueber Einladungen ihr eigenes Passwort setzen oder ein externer Auth-Provider wie Supabase Auth, Clerk oder Auth.js verwendet werden.

## Start

```bash
npm run dev
```

Danach im Browser oeffnen:

- `http://localhost:3000/staff/calendar`
- `http://localhost:3000/staff/working-hours`
- `http://localhost:3000/staff/bookings/new`
- `http://localhost:3000/admin`

## Validierung

- Termine muessen eine Startzeit vor der Endzeit haben.
- Termine duerfen sich fuer denselben Mitarbeiter am selben Datum nicht ueberschneiden.
- Arbeitszeit-Start muss vor Arbeitszeit-Ende liegen.
- Pausen muessen innerhalb der Arbeitszeit liegen.
