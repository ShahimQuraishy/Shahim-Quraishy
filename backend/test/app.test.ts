import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { InMemoryDataService } from '../src/services/providerService.js';

const apiKey = 'test-key';

describe('API behavior', () => {
  it('returns search result in requested response format', async () => {
    const service = new InMemoryDataService();
    await service.upsertProviders([
      {
        sourceRecordId: 'a1',
        firmenname: 'Test Apotheke',
        kategorie: 'Apotheken',
        strasse: 'Hauptstraße',
        hausnummer: '10',
        plz: '56068',
        ort: 'Koblenz',
        bundesland: 'Rheinland-Pfalz',
        telefonnummer: '0261-123456',
        geoLatitude: 50.3569,
        geoLongitude: 7.5889,
        datenquelle: 'import',
        oeffnungszeitenText: 'Mo-Fr 08:00-18:00'
      }
    ]);

    const app = createApp(service, apiKey);
    const response = await request(app).get('/api/search?city=Koblenz&category=Apotheken');

    expect(response.status).toBe(200);
    expect(response.body[0]).toEqual({
      name: 'Test Apotheke',
      adresse: 'Hauptstraße 10, 56068 Koblenz',
      telefonnummer: '0261-123456',
      oeffnungszeiten: 'Mo-Fr 08:00-18:00',
      entfernung_km: ''
    });
  });

  it('protects update endpoint with api key', async () => {
    const app = createApp(new InMemoryDataService(), apiKey);
    const response = await request(app).post('/api/providers/upsert').send({ records: [] });
    expect(response.status).toBe(401);
  });

  it('queues call forwarding with api key', async () => {
    const app = createApp(new InMemoryDataService(), apiKey);
    const response = await request(app)
      .post('/api/calls/forward')
      .set('x-api-key', apiKey)
      .send({ phoneNumber: '+49261123456' });

    expect(response.status).toBe(202);
    expect(response.body.status).toBe('queued');
    expect(response.body.phoneNumber).toBe('+49261123456');
  });
});
