-- Apotheke in meiner Nähe (Radius 5 km)
SELECT firmenname, telefonnummer, ort
FROM service_providers
WHERE kategorie ILIKE 'Apotheken'
  AND aktiv = true;

-- Hausarzt in Koblenz
SELECT firmenname, straße, hausnummer, telefonnummer
FROM service_providers
WHERE kategorie ILIKE 'Ärzte'
  AND ort ILIKE 'Koblenz'
  AND aktiv = true;

-- Offenes Bürgeramt
SELECT firmenname, telefonnummer
FROM service_providers
WHERE kategorie ILIKE 'Behörden'
  AND unterkategorie ILIKE 'Bürgeramt'
  AND provider_is_open(oeffnungszeiten) = true
  AND aktiv = true;
