import { useState, useCallback, useEffect } from 'react';
import api from '../api/axios.js';

/**
 * Fetch flight info from the AviationStack-backed /api/flights/info endpoint.
 * Results are Redis-cached on the backend — safe to call without worrying about quota.
 *
 * @param {string|null} flightNumber  IATA flight code, e.g. "KQ101"
 * @param {string|null} date          YYYY-MM-DD, defaults to today if omitted
 * @param {boolean}     eager         Auto-fetch on mount when flightNumber is truthy
 */
export default function useFlightInfo(flightNumber, date = null, eager = false) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const load = useCallback(async () => {
        if (!flightNumber) return;
        setLoading(true);
        setError(null);
        try {
            const params = { iata: flightNumber };
            if (date) params.date = date;
            const res = await api.get('/flights/info', { params });
            setData(res.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Flight data unavailable');
        } finally {
            setLoading(false);
        }
    }, [flightNumber, date]);

    useEffect(() => {
        if (eager && flightNumber) load();
    }, [eager, flightNumber]); // eslint-disable-line react-hooks/exhaustive-deps

    return { data, loading, error, load };
}
