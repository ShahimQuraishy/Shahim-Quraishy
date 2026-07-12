import { Router } from 'express';
import { z } from 'zod';
import { requireApiKey } from '../middleware/requireApiKey.js';
const providerSchema = z.object({
    sourceRecordId: z.string().min(1),
    firmenname: z.string().min(1),
    kategorie: z.string().min(1),
    unterkategorie: z.string().optional().nullable(),
    strasse: z.string().min(1),
    hausnummer: z.string().min(1),
    plz: z.string().min(3),
    ort: z.string().min(1),
    bundesland: z.string().min(1),
    telefonnummer: z.string().min(3),
    website: z.string().url().optional().nullable(),
    email: z.string().email().optional().nullable(),
    oeffnungszeiten: z.record(z.string(), z.array(z.object({ start: z.string(), end: z.string() }))).optional().nullable(),
    oeffnungszeitenText: z.string().optional().nullable(),
    barrierefrei: z.boolean().optional(),
    notdienst: z.boolean().optional(),
    geoLatitude: z.number().min(-90).max(90),
    geoLongitude: z.number().min(-180).max(180),
    datenquelle: z.string().min(1),
    aktiv: z.boolean().optional()
});
const upsertSchema = z.object({ records: z.array(providerSchema).min(1) });
const callForwardSchema = z.object({
    providerId: z.string().uuid().optional(),
    phoneNumber: z.string().min(3),
    seniorId: z.string().uuid().optional().nullable()
});
export const createRouter = (dataService, apiKey) => {
    const router = Router();
    router.get('/health', (_req, res) => {
        res.json({ status: 'ok' });
    });
    router.get('/api/search', async (req, res, next) => {
        try {
            const results = await dataService.searchProviders({
                city: req.query.city?.toString(),
                postalCode: req.query.postalCode?.toString(),
                category: req.query.category?.toString(),
                openNow: req.query.openNow === 'true',
                latitude: req.query.latitude ? Number(req.query.latitude) : undefined,
                longitude: req.query.longitude ? Number(req.query.longitude) : undefined,
                radiusKm: req.query.radiusKm ? Number(req.query.radiusKm) : undefined,
                limit: req.query.limit ? Number(req.query.limit) : undefined
            });
            res.json(results.map((item) => ({
                name: item.name,
                adresse: item.address,
                telefonnummer: item.phoneNumber,
                oeffnungszeiten: item.openingHours,
                entfernung_km: item.distanceKm
            })));
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/api/providers/upsert', requireApiKey(apiKey), async (req, res, next) => {
        try {
            const payload = upsertSchema.parse(req.body);
            const summary = await dataService.upsertProviders(payload.records);
            res.status(202).json(summary);
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/api/calls/forward', requireApiKey(apiKey), async (req, res, next) => {
        try {
            const payload = callForwardSchema.parse(req.body);
            const result = await dataService.forwardCall(payload);
            res.status(202).json({
                status: 'queued',
                referenceId: result.referenceId,
                phoneNumber: result.phoneNumber
            });
        }
        catch (error) {
            next(error);
        }
    });
    router.post('/api/maintenance/run', requireApiKey(apiKey), async (_req, res, next) => {
        try {
            const summary = await dataService.runMaintenance();
            res.status(202).json(summary);
        }
        catch (error) {
            next(error);
        }
    });
    return router;
};
