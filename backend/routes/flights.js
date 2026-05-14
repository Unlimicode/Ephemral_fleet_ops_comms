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

// Format a UTC ISO string as Africa/Nairobi (EAT, UTC+3) for display.
function toEAT(iso) {
    if (!iso) return null;
    try {
        return new Date(iso).toLocaleString('en-KE', {
            timeZone: 'Africa/Nairobi',
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', hour12: false,
        }) + ' EAT';
    } catch {
        return null;
    }
}

function shapeFlight(f) {
    return {
        found: true,
        flight_status: f.flight_status,
        flight_iata: f.flight?.iata,
        airline: f.airline?.name,
        departure: {
            airport: f.departure?.airport,
            iata: f.departure?.iata,
            terminal: f.departure?.terminal,
            gate: f.departure?.gate,
            scheduled: f.departure?.scheduled,
            estimated: f.departure?.estimated,
            actual: f.departure?.actual,
            scheduled_eat: toEAT(f.departure?.scheduled),
            estimated_eat: toEAT(f.departure?.estimated),
            actual_eat: toEAT(f.departure?.actual),
            delay: f.departure?.delay,
        },
        arrival: {
            airport: f.arrival?.airport,
            iata: f.arrival?.iata,
            terminal: f.arrival?.terminal,
            gate: f.arrival?.gate,
            scheduled: f.arrival?.scheduled,
            estimated: f.arrival?.estimated,
            actual: f.arrival?.actual,
            scheduled_eat: toEAT(f.arrival?.scheduled),
            estimated_eat: toEAT(f.arrival?.estimated),
            actual_eat: toEAT(f.arrival?.actual),
            delay: f.arrival?.delay,
        },
    };
}

// GET /api/flights/info?iata=KQ101&date=2026-05-14
// Protected: managers and drivers (requireAuth handles both)
router.get('/info', requireAuth(), async (req, res) => {
    const { iata, date } = req.query;
    if (!iata) return res.status(400).json({ error: 'iata query parameter is required' });

    const normalized = iata.replace(/\s+/g, '').toUpperCase();
    const flightDate = date || new Date().toISOString().split('T')[0];
    const cacheKey = `flight:${normalized}:${flightDate}`;

    try {
        const cached = await getSession(cacheKey);
        if (cached) return res.json({ ...cached, cached: true });

        const apiKey = process.env.AVIATIONSTACK_KEY;
        if (!apiKey) {
            return res.status(503).json({
                error: 'Flight lookup not configured',
                hint: 'Set AVIATIONSTACK_KEY in the backend environment.'
            });
        }

        const url = `${AVIATIONSTACK_BASE}?access_key=${apiKey}&flight_iata=${normalized}&flight_date=${flightDate}`;
        let response;
        try {
            response = await fetch(url, { headers: { 'Accept': 'application/json' } });
        } catch (fetchErr) {
            console.error('[flights] network error:', fetchErr.message);
            return res.status(502).json({ error: 'Could not reach flight provider', detail: fetchErr.message });
        }

        let json;
        try {
            json = await response.json();
        } catch {
            return res.status(502).json({ error: 'Flight provider returned non-JSON' });
        }

        if (json.error) {
            return res.status(502).json({
                error: json.error.message || json.error.info || 'Flight provider error',
                code: json.error.code || null,
            });
        }

        const flights = json.data;
        if (!flights || flights.length === 0) {
            const payload = {
                found: false,
                searched: { iata: normalized, date: flightDate },
                message: 'No flight found for that IATA code and date.'
            };
            await setSession(cacheKey, payload, 300);
            return res.json(payload);
        }

        const result = shapeFlight(flights[0]);
        const ttl = cacheTTL(result.flight_status, result.departure?.scheduled);
        await setSession(cacheKey, result, ttl);

        return res.json({ ...result, cached: false });
    } catch (err) {
        console.error('[flights] fetch error:', err.message);
        return res.status(502).json({ error: 'Failed to fetch flight data', detail: err.message });
    }
});

export default router;
