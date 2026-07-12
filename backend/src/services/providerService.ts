import { randomUUID, createHash } from 'node:crypto';
import type { Pool } from 'pg';
import type { ProviderSearchResult, ProviderUpsertInput, SearchFilters } from '../types/models.js';

export interface DataService {
  searchProviders(filters: SearchFilters): Promise<ProviderSearchResult[]>;
  upsertProviders(records: ProviderUpsertInput[]): Promise<{ inserted: number; updated: number; unchanged: number }>;
  forwardCall(payload: { providerId?: string; phoneNumber: string; seniorId?: string | null }): Promise<{ referenceId: string; phoneNumber: string }>;
  runMaintenance(): Promise<{ duplicatesMarked: number; staleMarked: number; oldCallsAnonymized: number }>;
}

const calcHash = (input: ProviderUpsertInput): string =>
  createHash('sha256')
    .update(
      JSON.stringify({
        ...input,
        oeffnungszeiten: input.oeffnungszeiten ?? null,
        oeffnungszeitenText: input.oeffnungszeitenText ?? null,
        website: input.website ?? null,
        email: input.email ?? null,
        unterkategorie: input.unterkategorie ?? null
      })
    )
    .digest('hex');

export class PgDataService implements DataService {
  constructor(private readonly pool: Pool, private readonly retentionDays: number) {}

  async searchProviders(filters: SearchFilters): Promise<ProviderSearchResult[]> {
    const values: Array<string | number | boolean> = [];
    let index = 1;
    const where: string[] = ['sp.aktiv = true'];

    if (filters.city) {
      where.push(`sp.ort ILIKE $${index++}`);
      values.push(filters.city);
    }
    if (filters.postalCode) {
      where.push(`sp.plz = $${index++}`);
      values.push(filters.postalCode);
    }
    if (filters.category) {
      where.push(`sp.kategorie ILIKE $${index++}`);
      values.push(filters.category);
    }
    if (filters.openNow) {
      where.push('provider_is_open(sp.oeffnungszeiten) = true');
    }

    let distanceSql = 'NULL::numeric(10,2) AS entfernung_km';
    if (typeof filters.latitude === 'number' && typeof filters.longitude === 'number') {
      distanceSql = `(
        6371 * acos(
          cos(radians($${index})) * cos(radians(sp.geo_latitude)) *
          cos(radians(sp.geo_longitude) - radians($${index + 1})) +
          sin(radians($${index})) * sin(radians(sp.geo_latitude))
        )
      )::numeric(10,2) AS entfernung_km`;
      values.push(filters.latitude, filters.longitude);
      const distanceExpr = `(
        6371 * acos(
          cos(radians($${index})) * cos(radians(sp.geo_latitude)) *
          cos(radians(sp.geo_longitude) - radians($${index + 1})) +
          sin(radians($${index})) * sin(radians(sp.geo_latitude))
        )
      )`;
      index += 2;
      if (typeof filters.radiusKm === 'number') {
        where.push(`${distanceExpr} <= $${index++}`);
        values.push(filters.radiusKm);
      }
    }

    const limit = Math.min(filters.limit ?? 20, 100);
    values.push(limit);
    const query = `
      SELECT
        sp.id,
        sp.firmenname AS name,
        concat_ws(' ', concat_ws(' ', sp.straße, sp.hausnummer), concat_ws(' ', sp.plz, sp.ort)) AS adresse,
        sp.telefonnummer,
        COALESCE(sp.oeffnungszeiten_text, 'Nicht hinterlegt') AS oeffnungszeiten,
        ${distanceSql}
      FROM service_providers sp
      WHERE ${where.join(' AND ')}
      ORDER BY entfernung_km NULLS LAST, sp.firmenname ASC
      LIMIT $${values.length}
    `;

    const result = await this.pool.query<{
      id: string;
      name: string;
      adresse: string;
      telefonnummer: string;
      oeffnungszeiten: string;
      entfernung_km: number | null;
    }>(query, values);

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      address: row.adresse,
      phoneNumber: row.telefonnummer,
      openingHours: row.oeffnungszeiten,
      distanceKm: row.entfernung_km === null ? '' : row.entfernung_km.toString()
    }));
  }

  async upsertProviders(records: ProviderUpsertInput[]): Promise<{ inserted: number; updated: number; unchanged: number }> {
    let inserted = 0;
    let updated = 0;
    let unchanged = 0;

    for (const record of records) {
      const hash = calcHash(record);
      const existing = await this.pool.query<{ id: string; data_hash: string }>(
        'SELECT id, data_hash FROM service_providers WHERE source_record_id = $1 AND datenquelle = $2 LIMIT 1',
        [record.sourceRecordId, record.datenquelle]
      );

      if (existing.rows[0] && existing.rows[0].data_hash === hash) {
        unchanged += 1;
        await this.pool.query(
          'UPDATE service_providers SET letzte_aktualisierung = now(), last_seen_at = now(), aktiv = true WHERE id = $1',
          [existing.rows[0].id]
        );
        continue;
      }

      const values = [
        record.sourceRecordId,
        record.firmenname,
        record.kategorie,
        record.unterkategorie ?? null,
        record.strasse,
        record.hausnummer,
        record.plz,
        record.ort,
        record.bundesland,
        record.telefonnummer,
        record.website ?? null,
        record.email ?? null,
        record.oeffnungszeiten ?? null,
        record.oeffnungszeitenText ?? null,
        record.barrierefrei ?? false,
        record.notdienst ?? false,
        record.geoLatitude,
        record.geoLongitude,
        record.datenquelle,
        record.aktiv ?? true,
        hash
      ];

      await this.pool.query(
        `
        INSERT INTO service_providers (
          source_record_id, firmenname, kategorie, unterkategorie, straße, hausnummer, plz, ort,
          bundesland, telefonnummer, website, email, oeffnungszeiten, oeffnungszeiten_text,
          barrierefrei, notdienst, geo_latitude, geo_longitude, datenquelle, aktiv, data_hash,
          letzte_aktualisierung, last_seen_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,now(),now()
        )
        ON CONFLICT (source_record_id, datenquelle) DO UPDATE SET
          firmenname = EXCLUDED.firmenname,
          kategorie = EXCLUDED.kategorie,
          unterkategorie = EXCLUDED.unterkategorie,
          straße = EXCLUDED.straße,
          hausnummer = EXCLUDED.hausnummer,
          plz = EXCLUDED.plz,
          ort = EXCLUDED.ort,
          bundesland = EXCLUDED.bundesland,
          telefonnummer = EXCLUDED.telefonnummer,
          website = EXCLUDED.website,
          email = EXCLUDED.email,
          oeffnungszeiten = EXCLUDED.oeffnungszeiten,
          oeffnungszeiten_text = EXCLUDED.oeffnungszeiten_text,
          barrierefrei = EXCLUDED.barrierefrei,
          notdienst = EXCLUDED.notdienst,
          geo_latitude = EXCLUDED.geo_latitude,
          geo_longitude = EXCLUDED.geo_longitude,
          data_hash = EXCLUDED.data_hash,
          letzte_aktualisierung = now(),
          last_seen_at = now(),
          stale_reason = NULL,
          aktiv = EXCLUDED.aktiv
      `,
        values
      );

      if (existing.rows[0]) {
        updated += 1;
      } else {
        inserted += 1;
      }
    }

    return { inserted, updated, unchanged };
  }

  async forwardCall(payload: { providerId?: string; phoneNumber: string; seniorId?: string | null }): Promise<{ referenceId: string; phoneNumber: string }> {
    const referenceId = randomUUID();
    await this.pool.query(
      `
      INSERT INTO call_forward_events (reference_id, provider_id, ziel_telefonnummer, senior_id, status)
      VALUES ($1, $2, $3, $4, 'queued')
      `,
      [referenceId, payload.providerId ?? null, payload.phoneNumber, payload.seniorId ?? null]
    );

    return { referenceId, phoneNumber: payload.phoneNumber };
  }

  async runMaintenance(): Promise<{ duplicatesMarked: number; staleMarked: number; oldCallsAnonymized: number }> {
    const duplicateUpdate = await this.pool.query<{ count: string }>(`
      WITH ranked AS (
        SELECT id,
               row_number() OVER (
                 PARTITION BY lower(firmenname), lower(COALESCE(telefonnummer, '')), lower(straße), lower(hausnummer), plz, lower(ort)
                 ORDER BY letzte_aktualisierung DESC
               ) AS rn
        FROM service_providers
        WHERE aktiv = true
      )
      UPDATE service_providers sp
      SET aktiv = false,
          stale_reason = 'duplicate'
      FROM ranked r
      WHERE sp.id = r.id
        AND r.rn > 1
      RETURNING 1
    `);

    const staleUpdate = await this.pool.query<{ count: string }>(`
      UPDATE service_providers
      SET aktiv = false,
          stale_reason = 'outdated'
      WHERE aktiv = true
        AND last_seen_at < (now() - interval '180 days')
      RETURNING 1
    `);

    const anonymizeCalls = await this.pool.query<{ count: string }>(
      `
      UPDATE call_history
      SET transcript_summary = NULL,
          metadata = '{}'::jsonb,
          anonymized_at = now()
      WHERE started_at < (now() - ($1::int || ' days')::interval)
        AND anonymized_at IS NULL
      RETURNING 1
      `,
      [this.retentionDays]
    );

    return {
      duplicatesMarked: duplicateUpdate.rowCount,
      staleMarked: staleUpdate.rowCount,
      oldCallsAnonymized: anonymizeCalls.rowCount
    };
  }
}

export class InMemoryDataService implements DataService {
  private records: ProviderUpsertInput[] = [];

  async searchProviders(filters: SearchFilters): Promise<ProviderSearchResult[]> {
    let data = [...this.records].filter((r) => r.aktiv !== false);
    if (filters.city) data = data.filter((r) => r.ort.toLowerCase() === filters.city?.toLowerCase());
    if (filters.postalCode) data = data.filter((r) => r.plz === filters.postalCode);
    if (filters.category) data = data.filter((r) => r.kategorie.toLowerCase() === filters.category?.toLowerCase());
    return data.slice(0, filters.limit ?? 20).map((r, idx) => ({
      id: `mem-${idx}`,
      name: r.firmenname,
      address: `${r.strasse} ${r.hausnummer}, ${r.plz} ${r.ort}`,
      phoneNumber: r.telefonnummer,
      openingHours: r.oeffnungszeitenText ?? 'Nicht hinterlegt',
      distanceKm: ''
    }));
  }

  async upsertProviders(records: ProviderUpsertInput[]): Promise<{ inserted: number; updated: number; unchanged: number }> {
    let inserted = 0;
    let updated = 0;

    for (const record of records) {
      const idx = this.records.findIndex((r) => r.sourceRecordId === record.sourceRecordId && r.datenquelle === record.datenquelle);
      if (idx >= 0) {
        this.records[idx] = { ...this.records[idx], ...record };
        updated += 1;
      } else {
        this.records.push(record);
        inserted += 1;
      }
    }

    return { inserted, updated, unchanged: 0 };
  }

  async forwardCall(payload: { providerId?: string; phoneNumber: string }): Promise<{ referenceId: string; phoneNumber: string }> {
    return { referenceId: payload.providerId ?? randomUUID(), phoneNumber: payload.phoneNumber };
  }

  async runMaintenance(): Promise<{ duplicatesMarked: number; staleMarked: number; oldCallsAnonymized: number }> {
    return { duplicatesMarked: 0, staleMarked: 0, oldCallsAnonymized: 0 };
  }
}
