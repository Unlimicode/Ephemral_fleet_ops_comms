import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../api/axios';
import ManagerLayout from '../components/layout/ManagerLayout.jsx';
import PageWrapper from '../components/layout/PageWrapper.jsx';
import GlassCard from '../components/layout/GlassCard.jsx';

const getEventMessage = (type, data) => {
    const ref = data.id || data.tripId;
    switch (type) {
        case 'session_created': return `Session opened · Trip #${ref}`;
        case 'session_destroyed': return `Session expired · Trip #${ref} · All data wiped`;
        case 'complaint_filed': return `Complaint filed · Trip #${ref} · Data preserved in PostgreSQL`;
        case 'trip_assigned': return `Trip assigned · Driver ${data.driverName || 'assigned'} · Trip #${ref}`;
        default: return `Event on Trip #${ref}`;
    }
};

const getEventColor = (type) => {
    switch (type) {
        case 'session_created': return '#10b981'; // green
        case 'session_destroyed': return '#ef4444'; // red
        case 'complaint_filed': return '#f59e0b'; // amber
        case 'trip_assigned': return '#3b82f6'; // blue
        default: return 'var(--text-muted)';
    }
};

export default function ManagerPrivacyDashboardPage() {
    const [sessions, setSessions] = useState([]);
    const [summary, setSummary] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const socketRef = useRef(null);

    // --- Data Fetching ---

    const fetchSessions = useCallback(async () => {
        try {
            const res = await api.get('/dashboard/sessions');
            setSessions(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch sessions', err);
        }
    }, []);

    const fetchSummary = useCallback(async () => {
        try {
            const res = await api.get('/dashboard/summary');
            setSummary(res.data);
        } catch (err) {
            console.error('Failed to fetch summary', err);
        }
    }, []);

    const addEvent = useCallback((type, data) => {
        const event = {
            id: Date.now(),
            type,
            id_ref: data.id || data.tripId,
            timestamp: new Date().toLocaleTimeString(),
            message: getEventMessage(type, data),
            color: getEventColor(type)
        };
        setEvents(prev => [event, ...prev].slice(0, 50));
    }, []);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const deferredFetch = async () => {
            setLoading(true);
            try {
                await Promise.all([fetchSessions(), fetchSummary()]);
                setError(false);
            } catch {
                setError(true);
            } finally {
                setLoading(false);
            }
        };
        deferredFetch();
        const sessInterval = setInterval(fetchSessions, 5000);
        const summInterval = setInterval(fetchSummary, 30000);

        // Socket.IO for Lifecycle Feed
        socketRef.current = io(import.meta.env.VITE_WS_URL + '/dashboard');
        socketRef.current.on('session_created', (data) => addEvent('session_created', data));
        socketRef.current.on('session_destroyed', (data) => addEvent('session_destroyed', data));
        socketRef.current.on('complaint_filed', (data) => addEvent('complaint_filed', data));
        socketRef.current.on('trip_assigned', (data) => addEvent('trip_assigned', data));

        return () => {
            clearInterval(sessInterval);
            clearInterval(summInterval);
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [fetchSessions, fetchSummary, addEvent]);

    const handleExport = async () => {
        try {
            const res = await api.get('/dashboard/compliance-report');
            const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `swiftlink-compliance-${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Export failed', err);
        }
    };

    if (loading && !summary && sessions.length === 0) {
        return (
            <PageWrapper>
                <div style={{ textAlign: 'center', padding: '100px', opacity: 0.5 }}>
                    <div className="spinner" style={{ margin: '0 auto 12px' }} />
                    Loading dashboard...
                </div>
            </PageWrapper>
        );
    }

    if (error && !summary) {
        return (
            <PageWrapper>
                <div style={{ textAlign: 'center', padding: '100px' }}>
                    <h2 style={{ color: '#EF4444' }}>Failed to load dashboard data</h2>
                    <button onClick={() => window.location.reload()} className="glass-button" style={{ padding: '10px 20px', borderRadius: '12px' }}>Retry</button>
                </div>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.5px' }}>Privacy Dashboard</h1>
                <button onClick={handleExport} className="glass-button" style={{ padding: '10px 20px', borderRadius: '12px', fontSize: '14px', fontWeight: 700 }}>
                    Export Compliance Report
                </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px' }}>

                {/* Section 1: Live Session Monitor */}
                <GlassCard style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', animation: 'pulse 2s infinite' }} />
                        <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Live Sessions</h2>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {sessions.length > 0 ? sessions.map(s => (
                            <SessionRow key={s.tripId} session={s} />
                        )) : (
                            <div style={{ textAlign: 'center', padding: '40px 0', opacity: 0.5 }}>
                                <span style={{ fontSize: '32px', display: 'block', marginBottom: '8px' }}>🛡️</span>
                                <p style={{ fontSize: '14px' }}>No active sessions. All data has been expired.</p>
                            </div>
                        )}
                    </div>
                </GlassCard>

                {/* Section 2: TTL Countdown Rings */}
                <GlassCard style={{ padding: '24px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px' }}>Session Lifetimes</h2>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', justifyContent: 'center' }}>
                        {sessions.filter(s => s.ttl > 0).slice(0, 6).map(s => (
                            <TTLRing key={`${s.tripId}-${s.ttl}`} session={s} />
                        ))}
                        {sessions.filter(s => s.ttl > 0).length === 0 && (
                            <p style={{ opacity: 0.5, fontSize: '14px', marginTop: '40px' }}>No active TTL counters.</p>
                        )}
                    </div>
                </GlassCard>

                {/* Section 3: Data Lifecycle Feed */}
                <GlassCard style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '18px', fontWeight: 800 }}>Data Lifecycle Events</h2>
                        <span style={{ padding: '2px 8px', background: 'rgba(0,0,0,0.05)', borderRadius: '20px', fontSize: '12px', fontWeight: 700 }}>{events.length}</span>
                    </div>
                    <div style={{ height: '360px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '8px' }}>
                        {events.length > 0 ? events.map(e => (
                            <div key={e.id} style={{ padding: '12px', background: 'rgba(255,255,255,0.4)', borderRadius: '12px', borderLeft: `4px solid ${e.color}`, animation: 'fadeIn 0.3s ease-out' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '4px' }}>{e.timestamp}</div>
                                <div style={{ fontSize: '13px', fontWeight: 600 }}>{e.message}</div>
                            </div>
                        )) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                                <p style={{ fontFamily: 'monospace', fontSize: '14px' }}>Waiting for events<span className="cursor-blink">_</span></p>
                            </div>
                        )}
                    </div>
                </GlassCard>

                {/* Section 4: Data Minimization Status */}
                <GlassCard style={{ padding: '24px' }}>
                    <h2 style={{ fontSize: '18px', fontWeight: 800, marginBottom: '24px' }}>Data Minimization Status</h2>
                    {summary ? (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
                                <MetricTile label="Sessions Created" value={summary.sessions_created} color="#3b82f6" />
                                <MetricTile label="Credentials Expired" value={summary.credentials_expired} color="#10b981" />
                                <MetricTile label="Data Wiped" value={summary.data_wiped} color="#10b981" icon="🛡️" />
                                <MetricTile label="Conditionally Persisted" value={summary.conditionally_persisted} color="#f59e0b" />
                            </div>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '13px', fontWeight: 700 }}>
                                    <span>Data minimization rate</span>
                                    <span style={{ color: 'var(--accent-success)' }}>{summary.minimization_rate}%</span>
                                </div>
                                <div style={{ height: '8px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${summary.minimization_rate}%`, background: 'var(--accent-success)', transition: 'width 1s ease-in-out' }} />
                                </div>
                                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '12px' }}>
                                    of completed trips left no permanent communication record.
                                </p>
                            </div>
                        </>
                    ) : (
                        <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                            Loading metrics...
                        </div>
                    )}
                </GlassCard>

            </div>
        </PageWrapper>
    );
}

function SessionRow({ session }) {
    const isRedis = session.dataLocation === 'redis';
    const statusColor = session.status === 'active' ? '#10b981' : session.status === 'complaint_window' ? '#f59e0b' : 'var(--text-muted)';

    return (
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.4)', padding: '12px 16px', borderRadius: '16px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusColor, marginRight: '12px' }} />
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>
                    Trip #{session.tripId.slice(0, 8)}...
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Driver ↔ Client</div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', padding: '2px 6px', borderRadius: '4px', background: isRedis ? '#dbeafe' : '#fef3c7', color: isRedis ? '#1e40af' : '#92400e', fontWeight: 800 }}>
                    {isRedis ? '⚡ Redis' : '🔒 PostgreSQL'}
                </span>
                <span style={{ fontSize: '11px', fontWeight: 700, color: statusColor }}>
                    {session.status.toUpperCase()}
                </span>
            </div>
        </div>
    );
}

const MAX_TTL = 3600;

function TTLRing({ session }) {
    const [timeLeft, setTimeLeft] = useState(session.ttl);

    useEffect(() => {
        const timer = setInterval(() => {
            setTimeLeft(prev => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const formatTime = (s) => {
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    };

    const perc = Math.min(100, (timeLeft / MAX_TTL) * 100);
    const ringColor = perc > 50 ? '#10b981' : perc > 25 ? '#f59e0b' : '#ef4444';
    const radius = 50;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (perc / 100) * circumference;

    return (
        <div style={{ textAlign: 'center', width: '120px' }}>
            <div style={{ position: 'relative', width: '100px', height: '100px', margin: '0 auto' }}>
                <svg width="100" height="100" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="8" />
                    <circle cx="60" cy="60" r={radius} fill="none" stroke={ringColor} strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 60 60)" style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s' }} />
                </svg>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'JetBrains Mono, monospace', fontSize: '13px', fontWeight: 800 }}>
                    {formatTime(timeLeft)}
                </div>
            </div>
            <div style={{ marginTop: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 800 }}>#{session.tripId.slice(0, 8)}</div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>{session.status}</div>
            </div>
        </div>
    );
}

function MetricTile({ label, value, color, icon }) {
    return (
        <div style={{ padding: '16px', background: 'rgba(255,255,255,0.4)', borderRadius: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                {icon && <span>{icon}</span>}
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{label}</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 900, color }}>{value}</div>
        </div>
    );
}
