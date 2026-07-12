export interface ProviderSearchResult {
  id: string;
  name: string;
  address: string;
  phoneNumber: string;
  openingHours: string;
  distanceKm: string;
}

export interface ProviderUpsertInput {
  sourceRecordId: string;
  firmenname: string;
  kategorie: string;
  unterkategorie?: string | null;
  strasse: string;
  hausnummer: string;
  plz: string;
  ort: string;
  bundesland: string;
  telefonnummer: string;
  website?: string | null;
  email?: string | null;
  oeffnungszeiten?: Record<string, Array<{ start: string; end: string }>> | null;
  oeffnungszeitenText?: string | null;
  barrierefrei?: boolean;
  notdienst?: boolean;
  geoLatitude: number;
  geoLongitude: number;
  datenquelle: string;
  aktiv?: boolean;
}

export interface SearchFilters {
  city?: string;
  postalCode?: string;
  category?: string;
  openNow?: boolean;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  limit?: number;
}
