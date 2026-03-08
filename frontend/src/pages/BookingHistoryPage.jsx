import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/axios';

export default function BookingHistoryPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                // Auth header injected by interceptor if token is set in AuthContext
                // or we pass it manually if it's just a query param flow.
                // For magic links, we'll pass it in header.
                const res = await api.get('/bookings/history', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setHistory(res.data);
            } catch {
                console.error('History fetch error');
            } finally {
                setLoading(false);
            }
        };
        if (token) fetchHistory();
    }, [token]);

    if (loading) return <div style={{ padding: '80px', textAlign: 'center' }}>Loading history...</div>;

    return (
        <div style={{ minHeight: '100vh', background: 'var(--bg-base)', padding: '40px 24px' }}>
            <div style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '40px' }}>
                    <img src="/swiftlink-icon.png" alt="S" style={{ height: '32px' }} />
                    <span style={{ fontSize: '1.4rem', fontWeight: 800 }}>wiftlink</span>
                </div>

                <h1 style={{ fontSize: '32px', fontWeight: 900, marginBottom: '8px', letterSpacing: '-1px' }}>Transfer History</h1>
                <p style={{ fontSize: '15px', color: 'var(--text-secondary)', marginBottom: '40px' }}>All bookings tied to your corporate email.</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {history.length === 0 ? (
                        <p style={{ textAlign: 'center', padding: '40px', opacity: 0.5 }}>No booking history found.</p>
                    ) : (
                        history.map(b => (
                            <Link
                                key={b.id}
                                to={`/booking?token=${token}&tripId=${b.id}`}
                                style={{ textDecoration: 'none', color: 'inherit' }}
                            >
                                <div className="glass-card" style={{ padding: '24px', borderRadius: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'transform 0.2s', cursor: 'pointer' }}>
                                    <div>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{
                                                fontSize: '10px', fontWeight: 800, textTransform: 'uppercase',
                                                padding: '4px 8px', borderRadius: '4px', background: 'rgba(0,0,0,0.05)',
                                                color: b.status === 'completed' ? 'var(--text-muted)' : 'var(--accent-primary)'
                                            }}>
                                                {b.status}
                                            </span>
                                            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{new Date(b.pickup_time).toLocaleDateString()}</span>
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '16px' }}>{b.pickup_location} → {b.destination}</div>
                                    </div>
                                    <span style={{ fontSize: '20px', opacity: 0.3 }}>→</span>
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
