import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getSession, setSession } from '../config/redisHelpers.js';

const router = Router();

const AVIATIONSTACK_BASE = 'http://api.aviationstack.com/v1/flights';

function cacheTTL(status, scheduledDeparture) {
    if (!status) return 300;
    const s = status.toLowerCase();
    if (s === 'landed' || s === 'cancelled' || s === 'diverted') return 3600;
    if (s === 'active') return 180;
    if (scheduledDeparture) {
        const minsAway = (new Date(scheduledDeparture) - Date.now()) / 60000;
        return minsAway < 120 ? 300 : 1800;
    }
    return 600;
}

// GET /api/flights/info?iata=KQ101&date=2026-05-14
// Protected: managers and drivers (requireAuth handles both)
router.get('/info', requireAuth, async (req, res) => {
    const { iata, date } = req.query;
    if (!iata) return res.status(400).json({ error: 'iata query parameter is required' });

    const normalized = iata.replace(/\s+/g, '').toUpperCase();
    const flightDate = date || new Date().toISOString().split('T')[0];
    const cacheKey = `flight:${normalized}:${flightDate}`;

    try {
        const cached = await getSession(cacheKey);
        if (cached) return res.json({ ...cached, cached: true });

        const apiKey = process.env.AVIATIONSTACK_KEY;
        if (!apiKey) return res.status(503).json({ error: 'Flight lookup not configured' });

        const url = `${AVIATIONSTACK_BASE}?access_key=${apiKey}&flight_iata=${normalized}&flight_date=${flightDate}`;
        const response = await fetch(url);
        const json = await response.json();

        if (json.error) {
            return res.status(502).json({ error: json.error.message || 'AviationStack error' });
        }

        const flights = json.data;
        if (!flights || flights.length === 0) {
            await setSession(cacheKey, { found: false }, 300);
            return res.json({ found: false });
        }

        const f = flights[0];
        const result = {
            found: true,
            flight_status: f.flight_status,
            flight_iata: f.flight?.iata,
            departure: {
                airport: f.departure?.airport,
                iata: f.departure?.iata,
                scheduled: f.departure?.scheduled,
                estimated: f.departure?.estimated,
                actual: f.departure?.actual,
            },
            arrival: {
                airport: f.arrival?.airport,
                iata: f.arrival?.iata,
                scheduled: f.arrival?.scheduled,
                estimated: f.arrival?.estimated,
                actual: f.arrival?.actual,
                terminal: f.arrival?.terminal,
                gate: f.arrival?.gate,
                delay: f.arrival?.delay,
            },
        };

        const ttl = cacheTTL(f.flight_status, f.departure?.scheduled);
        await setSession(cacheKey, result, ttl);

        return res.json({ ...result, cached: false });
    } catch (err) {
        console.error('[flights] fetch error:', err.message);
        return res.status(502).json({ error: 'Failed to fetch flight data' });
    }
});

export default router;
