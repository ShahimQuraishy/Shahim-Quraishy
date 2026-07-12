# Senior Assistant Backend

Node.js + TypeScript + PostgreSQL Backend für einen telefonischen KI-Assistenten für Senioren.

## Features

- Such-API für lokale Dienstleistungen (Ort, PLZ, Radius, Kategorie, Öffnungsstatus)
- Update-API für Datenimporte und Upserts
- API für Telefon-Weitervermittlung (Queue-Event)
- Datenpflege-Prozess: Änderungs-Erkennung, Dubletten-Markierung, Veraltungs-Markierung
- Erweiterte Tabellen für Senioren-Services (Nutzer, Angehörige, Favoriten, Notfallkontakte, Anrufhistorie)
- DSGVO-orientierte Datenhaltung (Datenminimierung in `call_history`, Anonymisierungsprozess)

## Start

```bash
cp .env.example .env
npm install
npm run dev
```

## Datenbank-Skripte

- `sql/001_schema.sql`: Vollständiges Schema inkl. Funktionen und Indizes
- `sql/002_example_queries.sql`: Beispielabfragen

Migration anwenden:

```bash
psql "$DATABASE_URL" -f sql/001_schema.sql
```

## REST API

### Suche

`GET /api/search`

Query-Parameter:
- `city`
- `postalCode`
- `radiusKm`
- `latitude`
- `longitude`
- `category`
- `openNow`
- `limit`

Antwortformat:

```json
{
  "name": "",
  "adresse": "",
  "telefonnummer": "",
  "oeffnungszeiten": "",
  "entfernung_km": ""
}
```

### Datensatzaktualisierung

`POST /api/providers/upsert` (Header: `x-api-key`)

Body:

```json
{
  "records": []
}
```

### Weitervermittlung

`POST /api/calls/forward` (Header: `x-api-key`)

Body:

```json
{
  "providerId": "uuid optional",
  "phoneNumber": "+49...",
  "seniorId": "uuid optional"
}
```

### Datenpflege

`POST /api/maintenance/run` (Header: `x-api-key`)

Aktionen:
- Dubletten-Markierung über identische Anbietermerkmale
- Veraltete Datensätze deaktivieren (`last_seen_at` > 180 Tage)
- Alte Anrufhistorie anonymisieren (Retention über `RETENTION_DAYS`)

## Docker

Im Repository-Root liegt `docker-compose.yml` für API + PostgreSQL.
