CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS service_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_record_id TEXT NOT NULL,
  firmenname TEXT NOT NULL,
  kategorie TEXT NOT NULL,
  unterkategorie TEXT,
  straße TEXT NOT NULL,
  hausnummer TEXT NOT NULL,
  plz TEXT NOT NULL,
  ort TEXT NOT NULL,
  bundesland TEXT NOT NULL,
  telefonnummer TEXT NOT NULL,
  website TEXT,
  email TEXT,
  oeffnungszeiten JSONB,
  oeffnungszeiten_text TEXT,
  barrierefrei BOOLEAN NOT NULL DEFAULT false,
  notdienst BOOLEAN NOT NULL DEFAULT false,
  geo_latitude NUMERIC(9,6) NOT NULL,
  geo_longitude NUMERIC(9,6) NOT NULL,
  letzte_aktualisierung TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  datenquelle TEXT NOT NULL,
  data_hash TEXT NOT NULL,
  stale_reason TEXT,
  aktiv BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uniq_source_record UNIQUE (source_record_id, datenquelle)
);

CREATE OR REPLACE FUNCTION provider_is_open(oeffnungszeiten JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  local_ts TIMESTAMPTZ := now() AT TIME ZONE 'Europe/Berlin';
  day_key TEXT := lower(to_char(local_ts, 'DY'));
  local_time TIME := local_ts::time;
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(oeffnungszeiten -> day_key, '[]'::jsonb)) slot
    WHERE (slot ->> 'start')::time <= local_time
      AND (slot ->> 'end')::time >= local_time
  );
END;
$$;

CREATE TABLE IF NOT EXISTS seniors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_ref TEXT UNIQUE,
  first_name TEXT,
  last_name TEXT,
  city TEXT,
  postal_code TEXT,
  preferred_language TEXT DEFAULT 'de',
  consent_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS relatives (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES seniors(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  relationship TEXT,
  phone_number TEXT NOT NULL,
  email TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES seniors(id) ON DELETE CASCADE,
  contact_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  priority SMALLINT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES seniors(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (senior_id, provider_id)
);

CREATE TABLE IF NOT EXISTS frequent_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID NOT NULL REFERENCES seniors(id) ON DELETE CASCADE,
  provider_id UUID NOT NULL REFERENCES service_providers(id) ON DELETE CASCADE,
  call_count INTEGER NOT NULL DEFAULT 0,
  last_called_at TIMESTAMPTZ,
  UNIQUE (senior_id, provider_id)
);

CREATE TABLE IF NOT EXISTS call_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  senior_id UUID REFERENCES seniors(id) ON DELETE SET NULL,
  provider_id UUID REFERENCES service_providers(id) ON DELETE SET NULL,
  query_text TEXT,
  transcript_summary TEXT,
  call_outcome TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  anonymized_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS call_forward_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_id UUID NOT NULL UNIQUE,
  provider_id UUID REFERENCES service_providers(id) ON DELETE SET NULL,
  senior_id UUID REFERENCES seniors(id) ON DELETE SET NULL,
  ziel_telefonnummer TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_providers_category ON service_providers (kategorie);
CREATE INDEX IF NOT EXISTS idx_providers_location ON service_providers (plz, ort);
CREATE INDEX IF NOT EXISTS idx_providers_active_seen ON service_providers (aktiv, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_history_senior_started ON call_history (senior_id, started_at DESC);
