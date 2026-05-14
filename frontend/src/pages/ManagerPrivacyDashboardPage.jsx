// ─────────────────────────────────────────────────────────────────────────────
// Manager Privacy Dashboard — the FYP's research surface.
//
// This page makes the MEI framework's privacy guarantees *visible* to a fleet
// manager and (more importantly) verifiable for the dissertation. It is the UI
// counterpart to the encryption + TTL + audit-log machinery on the backend.
//
// WHAT EACH PANEL SHOWS:
//   - Active sessions      — Redis session:trip:* keys currently alive, with
//                            live countdown of remaining TTL. When a TTL hits
//                            zero, the session physically dies — this proves
//                            ephemeral identity is enforced by infrastructure,
//                            not by code that "remembers" to delete things.
//   - Live event feed      — session_created / session_destroyed / complaint_filed
//                            events streamed over the /dashboard Socket.IO
//                            namespace; gives a real-time view of data lifecycle.
//   - Destruction events   — SHA-256 destruction hashes (utils/encryption.js
//                            computeDestructionHash) written to audit_log on
//                            session expiry. Proof-of-erasure without retaining
//                            the destroyed content itself (DPA 2019 s.41).
//   - Compliance report    — minimisation rate, complaint-window expirations,
//                            archive access counts — the headline metrics the
//                            dissertation argues SwiftLink improves.
//
// DATA SOURCES: /api/dashboard/* (backend/routes/dashboard.js) for snapshots,
// /dashboard Socket.IO namespace (backend/socket/dashboardNamespace.js) for live
// updates. PDF export goes through utils/compliancePdf.js.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext.jsx';
import useWindowWidth from '../hooks/useWindowWidth.js';
import { generateCompliancePDF } from '../utils/compliancePdf.js';

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
        case 'session_created': return '#10b981';
        case 'session_destroyed': return '#ef4444';
        case 'complaint_filed': return '#f59e0b';
        case 'trip_assigned': return '#3b82f6';
        default: return 'rgba(0,0,0,0.3)';
    }
};

export default function ManagerPrivacyDashboardPage() {
    const { token } = useAuth();
    const width = useWindowWidth();
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;
    const isDesktop = width >= 1024;

    const [sessions, setSessions] = useState([]);
    const [summary, setSummary] = useState(null);
    const [overview, setOverview] = useState(null);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const socketRef = useRef(null);
    const [expandedTripId, setExpandedTripId] = useState(null);
    const [tripDetail, setTripDetail] = useState({});
    const [destructionEvents, setDestructionEvents] = useState([]);
    const [ttlRegistry, setTtlRegistry] = useState({});

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

    const fetchOverview = useCallback(async () => {
        try {
            const res = await api.get('/dashboard/overview');
            setOverview(res.data);
        } catch (err) {
            console.error('Failed to fetch overview', err);
        }
    }, []);

    const fetchDestructionEvents = useCallback(async () => {
        try {
            const res = await api.get('/dashboard/destruction-events');
            setDestructionEvents(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Failed to fetch destruction events', err);
        }
    }, []);

    const applyRegistry = (arr) => {
        if (!Array.isArray(arr)) return;
        const obj = {};
        arr.forEach(e => { obj[e.trip_id] = e; });
        setTtlRegistry(obj);
    };

    const fetchRegistry = useCallback(async () => {
        try {
            const res = await api.get('/dashboard/registry');
            applyRegistry(res.data);
        } catch (err) {
            console.error('Failed to fetch TTL registry', err);
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
        const deferredFetch = async () => {
            setLoading(true);
            try {
                await Promise.all([fetchSessions(), fetchSummary(), fetchOverview(), fetchDestructionEvents(), fetchRegistry()]);
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
        const overviewInterval = setInterval(fetchOverview, 10000);

        socketRef.current = io(import.meta.env.VITE_WS_URL + '/dashboard', {
            auth: { token }
        });
        socketRef.current.on('session_created', (data) => addEvent('session_created', data));
        socketRef.current.on('session_destroyed', (data) => {
            addEvent('session_destroyed', data);
            if (data.destruction_hash) {
                setDestructionEvents(prev => [{
                    target_id: data.trip_id,
                    timestamp: data.timestamp || new Date().toISOString(),
                    destruction_hash: data.destruction_hash,
                    legal_basis: 'Trip data confinement',
                    retention_category: 'ephemeral',
                }, ...prev].slice(0, 20));
            }
        });
        socketRef.current.on('complaint_filed', (data) => addEvent('complaint_filed', data));
        socketRef.current.on('trip_assigned', (data) => addEvent('trip_assigned', data));
        socketRef.current.on('ttl_registry', (data) => applyRegistry(data));
        socketRef.current.on('ttl_update', (data) => applyRegistry(data));

        return () => {
            clearInterval(sessInterval);
            clearInterval(summInterval);
            clearInterval(overviewInterval);
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [fetchSessions, fetchSummary, fetchOverview, fetchDestructionEvents, fetchRegistry, addEvent, token]);

    const handleExportPDF = async () => {
        try {
            const res = await api.get('/dashboard/compliance-report');
            generateCompliancePDF(res.data);
        } catch (err) {
            console.error('PDF export failed', err);
        }
    };

    const fetchTripDetail = async (tripId) => {
        try {
            const res = await api.get(`/dashboard/trips/${tripId}`);
            setTripDetail(prev => ({ ...prev, [tripId]: res.data }));
        } catch (err) {
            console.error('Failed to fetch trip detail', err);
        }
    };

    const handleExportTripCSV = async () => {
        try {
            const [tripsRes, complaintsRes] = await Promise.all([
                api.get('/trips'),
                api.get('/complaints')
            ]);
            const trips = tripsRes.data;
            const complaintTripIds = new Set(complaintsRes.data.map(c => c.trip_id));

            const headers = ['Trip ID', 'Organisation', 'Pickup', 'Destination', 'Pickup Time', 'Driver', 'Vehicle', 'Status', 'Complaint Filed'];
            const rows = trips.map(t => [
                t.id,
                t.client_corporate_email?.split('@')[1] || '—',
                t.pickup_location,
                t.destination,
                t.pickup_time ? new Date(t.pickup_time).toLocaleString() : '—',
                t.driver_name || t.assigned_driver_id || '—',
                t.vehicle_reg || t.vehicle_id || '—',
                t.status,
                complaintTripIds.has(t.id) ? 'Yes' : 'No'
            ]);

            const csv = [headers, ...rows]
                .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
                .join('\n');

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `swiftlink-trips-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Trip CSV export failed', err);
        }
    };

    const TTLCountdown = ({ ttlSeconds }) => {
        const [timeLeft, setTimeLeft] = useState(ttlSeconds);
        useEffect(() => {
            if (ttlSeconds <= 0) return;
            const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
            return () => clearInterval(timer);
        }, [ttlSeconds]);
        const h = Math.floor(timeLeft / 3600);
        const m = Math.floor((timeLeft % 3600) / 60);
        const s = timeLeft % 60;
        const display = h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
        const pct = timeLeft / ttlSeconds;
        const color = pct > 0.5 ? '#00F5A0' : pct > 0.25 ? '#F59E0B' : '#E05A5A';
        return <span style={{ fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, color }}>{display}</span>;
    };

    if (loading && !summary && sessions.length === 0) {
        const sh = (w, h, mb = 0) => ({
            background: 'linear-gradient(90deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.10) 50%, rgba(0,0,0,0.05) 100%)',
            backgroundSize: '200% 100%',
            animation: 'shimmer 1.5s infinite linear',
            borderRadius: '12px',
            width: w, height: h, marginBottom: mb || undefined,
        });
        return (
            <div style={{ maxWidth: '1440px', margin: '0 auto', padding: isMobile ? '16px' : isTablet ? '16px 24px' : '20px 32px', fontFamily: "'Be Vietnam Pro', sans-serif" }}>
                <style>{`@keyframes shimmer { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }`}</style>
                {/* Header skeleton */}
                <div style={{ marginBottom: '40px' }}>
                    <div style={sh('120px', '12px', 10)} />
                    <div style={sh('340px', '48px', 0)} />
                </div>
                {/* Stat tiles skeleton */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: '16px', marginBottom: '32px' }}>
                    {[...Array(4)].map((_, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.4)', borderRadius: '24px', padding: '24px', border: '1px solid rgba(255,255,255,0.6)' }}>
                            <div style={sh('60%', '11px', 12)} />
                            <div style={sh('50%', '36px', 8)} />
                            <div style={sh('80%', '11px', 0)} />
                        </div>
                    ))}
                </div>
                {/* Two-column skeleton */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px' }}>
                    {[240, 200].map((h, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.4)', borderRadius: '24px', padding: '28px', border: '1px solid rgba(255,255,255,0.6)', height: `${h}px` }}>
                            <div style={sh('40%', '12px', 16)} />
                            <div style={sh('90%', '16px', 10)} />
                            <div style={sh('70%', '16px', 0)} />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (error && !summary) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px', gap: '16px' }}>
                <p style={{ color: '#EF4444', fontWeight: 700, fontFamily: "'Be Vietnam Pro', sans-serif" }}>Failed to load dashboard data</p>
                <button onClick={() => window.location.reload()} style={{ background: '#6C63FF', color: 'white', border: 'none', borderRadius: '999px', padding: '10px 24px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>Retry</button>
            </div>
        );
    }

    const activeSessions = (overview?.active_driver_sessions || 0) + (overview?.active_client_sessions || 0);
    const activeTrips = Math.max(overview?.active_trips || 1, 1);
    const overviewTrips = overview?.trips || [];

    return (
        <>
            <style>{`
                @keyframes pulse-dot {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(0.8); }
                }
                @keyframes float-slow {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-30px) rotate(8deg); }
                }
                @keyframes float-reverse {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(20px) rotate(-6deg); }
                }
                .privacy-card {
                    background: rgba(255,255,255,0.55);
                    backdrop-filter: blur(40px) saturate(180%);
                    -webkit-backdrop-filter: blur(40px) saturate(180%);
                    border: 1px solid rgba(255,255,255,0.7);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9);
                    border-radius: 2rem;
                    transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease;
                }
                .privacy-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 16px 48px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.95);
                }
                .status-pulse {
                    position: relative;
                }
                .status-pulse::after {
                    content: '';
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    background: inherit;
                    border-radius: 50%;
                    z-index: -1;
                    animation: pulse-dot 2s infinite;
                }
                .priv-geo-1 { animation: float-slow 11s ease-in-out infinite; }
                .priv-geo-2 { animation: float-reverse 9s ease-in-out infinite; }
                .priv-geo-3 { animation: float-slow 13s ease-in-out infinite; }
            `}</style>

            {/* Fixed background layer */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                <div style={{
                    position: 'absolute', inset: 0, opacity: 0.4,
                    backgroundImage: 'linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)',
                    backgroundSize: '80px 80px'
                }} />
                <div className="priv-geo-1" style={{ position: 'absolute', top: '10%', left: '3%', color: 'rgba(108,99,255,0.10)', pointerEvents: 'none' }}>
                    <div style={{ width: 0, height: 0, borderLeft: '120px solid transparent', borderRight: '120px solid transparent', borderBottom: '180px solid currentColor', transform: 'rotate(12deg) scale(1.5)' }} />
                </div>
                <div className="priv-geo-2" style={{ position: 'absolute', bottom: '8%', right: '5%', color: 'rgba(108,99,255,0.08)', pointerEvents: 'none' }}>
                    <div style={{ width: 0, height: 0, borderLeft: '100px solid transparent', borderRight: '100px solid transparent', borderBottom: '150px solid currentColor', transform: 'rotate(-15deg) scale(1.8)' }} />
                </div>
                <div className="priv-geo-3" style={{ position: 'absolute', top: '45%', right: '15%', color: 'rgba(0,212,255,0.06)', pointerEvents: 'none' }}>
                    <div style={{ width: 0, height: 0, borderLeft: '60px solid transparent', borderRight: '60px solid transparent', borderBottom: '90px solid currentColor', transform: 'rotate(25deg)' }} />
                </div>
            </div>

            {/* Page content */}
            <div style={{ position: 'relative', zIndex: 1, maxWidth: '1440px', margin: '0 auto', padding: isMobile ? '12px 16px 80px' : '16px 40px 80px', fontFamily: "'Be Vietnam Pro', sans-serif" }}>

                {/* HEADER */}
                <header style={{ marginBottom: '32px', display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', justifyContent: 'space-between', flexDirection: isMobile ? 'column' : 'row', gap: '16px' }}>
                    <div>
                        <h1 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: isMobile ? '36px' : '48px', fontWeight: 900, letterSpacing: '-0.03em', color: '#0D0D0D', marginBottom: '10px', textTransform: 'uppercase' }}>
                            Privacy Overview
                        </h1>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="status-pulse" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: '#00F5A0', flexShrink: 0 }} />
                            <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.4em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)' }}>
                                System Online // Secure Channel
                            </p>
                        </div>
                    </div>
                    <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
                        <button onClick={handleExportPDF} className="privacy-card" style={{ padding: '10px 20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#6C63FF', fontFamily: "'Be Vietnam Pro', sans-serif", borderRadius: '999px', background: 'rgba(255,255,255,0.55)' }}>
                            Export PDF
                        </button>
                        <button onClick={handleExportTripCSV} className="privacy-card" style={{ padding: '10px 20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: '#6C63FF', fontFamily: "'Be Vietnam Pro', sans-serif", borderRadius: '999px', background: 'rgba(255,255,255,0.55)' }}>
                            Export CSV
                        </button>
                    </div>
                </header>

                {/* STAT TILES ROW */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(4, 1fr)', gap: '20px', marginBottom: '24px' }}>

                    {/* Tile 1 — Active Sessions */}
                    <div className="privacy-card" style={{ padding: '24px' }}>
                        <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(0,0,0,0.4)', marginBottom: '12px' }}>Active Sessions</p>
                        <p style={{ fontSize: '40px', fontWeight: 900, color: '#0D0D0D', lineHeight: 1, marginBottom: '16px' }}>{activeSessions}</p>
                        <div style={{ width: '100%', height: '4px', borderRadius: '999px', background: 'rgba(0,0,0,0.06)' }}>
                            <div style={{ height: '100%', borderRadius: '999px', background: '#6C63FF', width: `${Math.min(100, (activeSessions / activeTrips) * 100)}%`, transition: 'width 0.8s ease' }} />
                        </div>
                    </div>

                    {/* Tile 2 — Message Buffers */}
                    <div className="privacy-card" style={{ padding: '24px' }}>
                        <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(0,0,0,0.4)', marginBottom: '12px' }}>Message Buffers</p>
                        <p style={{ fontSize: '40px', fontWeight: 900, color: '#6C63FF', lineHeight: 1, marginBottom: '8px' }}>{overview?.active_message_buffers || 0}</p>
                        <p style={{ fontSize: '10px', color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>active buffers</p>
                    </div>

                    {/* Tile 3 — Complaint Windows */}
                    <div className="privacy-card" style={{ padding: '24px' }}>
                        <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(0,0,0,0.4)', marginBottom: '12px' }}>Complaint Windows</p>
                        <p style={{ fontSize: '40px', fontWeight: 900, color: '#F59E0B', lineHeight: 1, marginBottom: '8px' }}>{overview?.open_complaint_windows || 0}</p>
                        <p style={{ fontSize: '10px', color: (overview?.open_complaint_windows || 0) > 0 ? '#F59E0B' : '#00A86B', fontWeight: 600 }}>
                            {(overview?.open_complaint_windows || 0) > 0 ? 'require attention' : 'all clear'}
                        </p>
                    </div>

                    {/* Tile 4 — Sessions Destroyed Today */}
                    <div className="privacy-card" style={{ padding: '24px' }}>
                        <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(0,0,0,0.4)', marginBottom: '12px' }}>Sessions Destroyed Today</p>
                        <p style={{ fontSize: '40px', fontWeight: 900, color: '#00F5A0', lineHeight: 1, marginBottom: '16px' }}>{overview?.sessions_destroyed_today || 0}</p>
                        <div style={{ width: '100%', height: '4px', borderRadius: '999px', background: 'rgba(0,245,160,0.15)' }}>
                            <div style={{ height: '100%', borderRadius: '999px', background: '#00F5A0', width: '100%' }} />
                        </div>
                    </div>

                </div>

                {/* MAIN GRID — 12 col desktop */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(12, 1fr)', gap: '24px' }}>

                    {/* Zone 1 — Minimization Rate (span 7) */}
                    <div className="privacy-card" style={{ gridColumn: isDesktop ? 'span 7' : 'span 1', padding: '40px', position: 'relative', overflow: 'hidden' }}>
                        <span className="material-symbols-outlined" style={{ position: 'absolute', top: 0, right: 0, fontSize: '160px', color: '#6C63FF', opacity: 0.04, pointerEvents: 'none', lineHeight: 1, userSelect: 'none' }}>auto_awesome</span>
                        <div style={{ position: 'relative', zIndex: 1 }}>
                            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'rgba(0,0,0,0.4)', marginBottom: '8px' }}>Primary Metric</p>
                            <h2 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', color: '#0D0D0D', marginBottom: '32px' }}>Data Confinement Rate</h2>
                            <div style={{ lineHeight: 1 }}>
                                <span style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '96px', fontWeight: 900, letterSpacing: '-0.05em', color: '#6C63FF', lineHeight: 1 }}>
                                    {summary?.minimization_rate || 0}
                                </span>
                                <span style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '40px', fontWeight: 900, color: '#6C63FF', opacity: 0.4 }}>%</span>
                            </div>
                            <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.45)', maxWidth: '380px', marginTop: '24px', lineHeight: 1.6 }}>
                                Percentage of trips where communication data was structurally confined — auto-destroyed at trip boundary with zero manual action. Higher is better.
                            </p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '24px' }}>
                                {[
                                    { label: 'Created', value: summary?.sessions_created || 0 },
                                    { label: 'Expired', value: summary?.credentials_expired || 0 },
                                    { label: 'Wiped', value: summary?.data_wiped || 0 },
                                    { label: 'Persisted', value: summary?.conditionally_persisted || 0 },
                                ].map(({ label, value }) => (
                                    <span key={label} style={{ background: 'rgba(108,99,255,0.08)', borderRadius: '999px', padding: '6px 14px', fontSize: '11px', fontWeight: 700, color: '#6C63FF' }}>
                                        {label}: {value}
                                    </span>
                                ))}
                            </div>
                            {(() => {
                                const wiped = summary?.data_wiped || 0;
                                const persisted = summary?.conditionally_persisted || 0;
                                const ratioTotal = wiped + persisted;
                                return (
                                    <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                        <p style={{ fontSize: '13px', fontWeight: 700, color: 'rgba(0,0,0,0.45)', marginBottom: '12px' }}>Data Outcome Ratio</p>
                                        {ratioTotal === 0 ? (
                                            <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.3)', fontStyle: 'italic' }}>No completed trips yet</p>
                                        ) : (
                                            <>
                                                <div style={{ width: '100%', height: '8px', borderRadius: '999px', background: 'rgba(0,0,0,0.08)', position: 'relative', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', borderRadius: '999px', background: 'linear-gradient(90deg, #00F5A0, #00D4FF)', width: `${(wiped / ratioTotal * 100).toFixed(1)}%`, transition: 'width 0.8s ease' }} />
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                                                    <span style={{ fontSize: '11px', color: '#00A86B', fontWeight: 600 }}>{wiped} auto-wiped</span>
                                                    <span style={{ fontSize: '11px', color: '#F59E0B', fontWeight: 600 }}>{persisted} persisted</span>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* Zone 2 — Live Session Monitor (span 5) */}
                    <div className="privacy-card" style={{ gridColumn: isDesktop ? 'span 5' : 'span 1', padding: '32px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexShrink: 0 }}>
                            <h2 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em', color: '#0D0D0D' }}>Live Session Monitor</h2>
                            <span style={{ background: 'rgba(0,245,160,0.15)', color: '#00A86B', borderRadius: '999px', padding: '4px 12px', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>Real-Time</span>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {overviewTrips.length > 0 ? overviewTrips.map(t => (
                                <div key={t.trip_id}>
                                    <div
                                        style={{ background: 'rgba(255,255,255,0.5)', borderRadius: '20px', padding: '14px 16px', border: '1px solid rgba(255,255,255,0.7)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                                        onClick={() => { const isExpanded = expandedTripId === t.trip_id; setExpandedTripId(isExpanded ? null : t.trip_id); if (!isExpanded) fetchTripDetail(t.trip_id); }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.72)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.5)'}
                                    >
                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(108,99,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#6C63FF' }}>route</span>
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{ fontSize: '13px', fontWeight: 700, color: '#0D0D0D', fontFamily: 'JetBrains Mono, monospace' }}>#{t.trip_id.slice(0, 8)}</p>
                                            <p style={{ fontSize: '10px', color: 'rgba(0,0,0,0.45)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {t.pickup_location} → {t.destination}
                                            </p>
                                        </div>
                                        {(() => {
                                            const reg = ttlRegistry[t.trip_id];
                                            const fmtTTL = (s) => {
                                                if (!s || s <= 0) return null;
                                                if (s >= 3600) return `${Math.floor(s / 3600)}h`;
                                                if (s >= 60) return `${Math.floor(s / 60)}m`;
                                                return `${s}s`;
                                            };
                                            if (reg) {
                                                return (
                                                    <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
                                                        {[
                                                            { ttl: reg.driver_ttl, color: '#00F5A0', label: 'Driver' },
                                                            { ttl: reg.client_ttl, color: '#6C63FF', label: 'Client' },
                                                            { ttl: reg.window_ttl, color: '#F59E0B', label: 'Window' },
                                                        ].map(({ ttl, color, label }) => {
                                                            const formatted = fmtTTL(ttl);
                                                            return formatted ? (
                                                                <span key={label} title={`${label} — ${ttl}s remaining`} style={{
                                                                    fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', fontWeight: 700,
                                                                    color, background: `${color}22`, borderRadius: '4px', padding: '2px 5px', lineHeight: 1.4
                                                                }}>{formatted}</span>
                                                            ) : (
                                                                <span key={label} title={`${label} — Inactive`} style={{
                                                                    width: '8px', height: '8px', borderRadius: '50%',
                                                                    background: 'rgba(0,0,0,0.12)', display: 'inline-block'
                                                                }} />
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                                                    <span title="Driver Session" style={{ width: '12px', height: '12px', borderRadius: '50%', background: t.driver_session_active ? '#00F5A0' : 'rgba(0,0,0,0.12)', display: 'inline-block' }} />
                                                    <span title="Client Session" style={{ width: '12px', height: '12px', borderRadius: '50%', background: t.client_session_active ? '#6C63FF' : 'rgba(0,0,0,0.12)', display: 'inline-block' }} />
                                                    <span title="Complaint Window" style={{ width: '12px', height: '12px', borderRadius: '50%', background: t.complaint_window_active ? '#F59E0B' : t.complaint_filed ? '#E05A5A' : 'rgba(0,0,0,0.12)', display: 'inline-block' }} />
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    {expandedTripId === t.trip_id && (
                                        <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '12px', padding: '16px', marginTop: '8px', marginBottom: '4px' }}>
                                            <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>Session Keys</p>
                                            {tripDetail[t.trip_id] ? (
                                                [
                                                    { key: 'driver', label: 'Driver Session', color: '#00F5A0' },
                                                    { key: 'client', label: 'Client Session', color: '#6C63FF' },
                                                    { key: 'message_buffer', label: 'Message Buffer', color: '#00D4FF' },
                                                    { key: 'complaint_window', label: 'Complaint Window', color: '#F59E0B' },
                                                ].map(({ key, label, color }) => {
                                                    const session = tripDetail[t.trip_id]?.sessions?.[key];
                                                    return (
                                                        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: color, display: 'inline-block' }} />
                                                                <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>{label}</span>
                                                            </div>
                                                            {session?.active
                                                                ? <TTLCountdown ttlSeconds={session.ttl_seconds || 0} />
                                                                : <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>Destroyed</span>
                                                            }
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>Loading session keys...</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
                                    <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.3)', fontStyle: 'italic' }}>No active sessions</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Zone 3 — Data Lifecycle Flow (span 7) */}
                    <div className="privacy-card" style={{ gridColumn: isDesktop ? 'span 7' : isTablet ? 'span 2' : 'span 1', padding: '32px' }}>
                        <h2 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em', color: '#0D0D0D', textAlign: 'center', marginBottom: '40px' }}>Data Lifecycle Flow</h2>
                        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', alignItems: 'center', justifyContent: 'center' }}>

                            {/* Node 1 — Creation */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'white', boxShadow: '0 4px 20px rgba(108,99,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#6C63FF' }}>sensors</span>
                                </div>
                                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.5)' }}>Creation</p>
                                <p style={{ fontSize: '18px', fontWeight: 900, color: '#6C63FF' }}>{summary?.sessions_created || 0}</p>
                            </div>

                            {/* Connector 1 */}
                            <div style={isMobile
                                ? { width: '2px', height: '32px', background: 'linear-gradient(180deg, #6C63FF, #00F5A0)', margin: '0 auto' }
                                : { flex: 1, height: '2px', background: 'linear-gradient(90deg, #6C63FF, #00F5A0)', minWidth: '24px' }
                            } />

                            {/* Node 2 — Minimization */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'white', boxShadow: '0 4px 20px rgba(108,99,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#6C63FF' }}>security</span>
                                </div>
                                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.5)' }}>Confinement</p>
                                <p style={{ fontSize: '18px', fontWeight: 900, color: '#6C63FF' }}>{summary?.sessions_created || 0}</p>
                            </div>

                            {/* Connector 2 */}
                            <div style={isMobile
                                ? { width: '2px', height: '32px', background: 'linear-gradient(180deg, #00F5A0, #00D4FF)', margin: '0 auto' }
                                : { flex: 1, height: '2px', background: 'linear-gradient(90deg, #00F5A0, #00D4FF)', minWidth: '24px' }
                            } />

                            {/* Node 3 — Auto-Wipe */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'white', boxShadow: '0 4px 20px rgba(0,212,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#00D4FF' }}>delete_sweep</span>
                                </div>
                                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.5)' }}>Auto-Wipe</p>
                                <p style={{ fontSize: '18px', fontWeight: 900, color: '#00D4FF' }}>{summary?.data_wiped || 0}</p>
                            </div>

                            {/* Connector 3 */}
                            <div style={isMobile
                                ? { width: '2px', height: '32px', background: 'linear-gradient(180deg, #00D4FF, rgba(0,0,0,0.15))', margin: '0 auto' }
                                : { flex: 1, height: '2px', background: 'linear-gradient(90deg, #00D4FF, rgba(0,0,0,0.15))', minWidth: '24px' }
                            } />

                            {/* Node 4 — Persistence */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'white', boxShadow: '0 4px 8px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'rgba(0,0,0,0.25)' }}>inventory_2</span>
                                </div>
                                <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.5)' }}>Persisted</p>
                                <p style={{ fontSize: '18px', fontWeight: 900, color: 'rgba(0,0,0,0.4)' }}>{summary?.conditionally_persisted || 0}</p>
                            </div>

                        </div>
                    </div>

                    {/* Zones 4+5 wrapper (span 5) */}
                    <div style={{ gridColumn: isDesktop ? 'span 5' : isTablet ? 'span 2' : 'span 1', display: 'flex', flexDirection: 'column', gap: '24px' }}>

                        {/* Zone 4 — Real-time Audit Feed */}
                        <div className="privacy-card" style={{ padding: '24px', height: '280px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
                                <h3 style={{ fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#0D0D0D' }}>Real-time Audit</h3>
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'rgba(0,0,0,0.3)' }}>sync</span>
                            </div>
                            <div style={{ flex: 1, overflowY: 'auto' }}>
                                {events.length > 0 ? events.map(e => (
                                    <div key={e.id} style={{ display: 'flex', gap: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(0,0,0,0.05)', marginBottom: '12px' }}>
                                        <span style={{ fontSize: '10px', fontWeight: 700, color: '#6C63FF', width: '40px', flexShrink: 0, fontFamily: 'JetBrains Mono, monospace' }}>{e.timestamp}</span>
                                        <div style={{ flex: 1, borderLeft: `3px solid ${e.color}`, paddingLeft: '8px' }}>
                                            <p style={{ fontSize: '12px', fontWeight: 700, color: '#0D0D0D', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{e.type}</p>
                                            <p style={{ fontSize: '10px', color: 'rgba(0,0,0,0.45)', marginTop: '2px' }}>{e.message}</p>
                                        </div>
                                    </div>
                                )) : (
                                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.3)', textAlign: 'center', padding: '24px' }}>Listening for events...</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Zone 5 — Compliance Export */}
                        <div className="privacy-card" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(255,255,255,0.6), rgba(108,99,255,0.05))', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '40px', color: '#6C63FF', marginBottom: '12px' }}>file_export</span>
                            <h3 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '16px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', color: '#0D0D0D', marginBottom: '8px' }}>Compliance Reporting</h3>
                            <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)', marginBottom: '24px', maxWidth: '280px', lineHeight: 1.6 }}>
                                Generate cryptographic proof of data deletion for legal and regulatory audits.
                            </p>
                            <button
                                onClick={handleExportPDF}
                                style={{ width: '100%', background: '#6C63FF', color: 'white', border: 'none', borderRadius: '999px', padding: '14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: "'Be Vietnam Pro', sans-serif", transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(108,99,255,0.3)'; }}
                                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px', fontVariationSettings: "'FILL' 1" }}>verified_user</span>
                                Export Compliance PDF
                            </button>
                            <p style={{ marginTop: '12px', fontSize: '11px', color: 'rgba(0,0,0,0.4)' }}>
                                Also available:{' '}
                                <span onClick={handleExportTripCSV} style={{ color: '#6C63FF', fontWeight: 600, cursor: 'pointer' }}>
                                    Export Trips CSV
                                </span>
                            </p>
                        </div>

                    </div>

                </div>

                {/* DESTRUCTION PROOF LOG — full width below main grid */}
                <div className="privacy-card" style={{ marginTop: '24px', padding: '32px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                        <div>
                            <h2 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.01em', color: '#0D0D0D', marginBottom: '4px' }}>Destruction Proof Log</h2>
                            <p style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>SHA-256 pre-deletion hashes — proof of trip-data confinement</p>
                        </div>
                        <span style={{ background: 'rgba(224,90,90,0.1)', color: '#E05A5A', borderRadius: '999px', padding: '4px 12px', fontSize: '10px', fontWeight: 700 }}>Append-Only</span>
                    </div>
                    {destructionEvents.length === 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', flexDirection: 'column', gap: '8px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '32px', color: 'rgba(0,0,0,0.15)' }}>verified_user</span>
                            <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.3)', fontStyle: 'italic' }}>No destruction events yet</p>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                        {['Trip ID', 'Timestamp', 'Category', 'Legal Basis', 'SHA-256 Hash'].map(h => (
                                            <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.4)' }}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {destructionEvents.map((e, i) => (
                                        <tr key={e.id || i} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                                            <td style={{ padding: '10px 12px', fontFamily: 'JetBrains Mono, monospace', color: '#6C63FF', fontWeight: 600 }}>#{(e.target_id || '').slice(0, 8)}</td>
                                            <td style={{ padding: '10px 12px', color: 'rgba(0,0,0,0.5)', whiteSpace: 'nowrap' }}>{new Date(e.timestamp).toLocaleString()}</td>
                                            <td style={{ padding: '10px 12px' }}>
                                                <span style={{ background: 'rgba(0,245,160,0.1)', color: '#00A86B', borderRadius: '999px', padding: '3px 10px', fontSize: '10px', fontWeight: 700 }}>{e.retention_category || 'ephemeral'}</span>
                                            </td>
                                            <td style={{ padding: '10px 12px', fontSize: '11px', color: 'rgba(0,0,0,0.45)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.legal_basis || '—'}</td>
                                            <td style={{ padding: '10px 12px' }}>
                                                {e.destruction_hash ? (
                                                    <span title={e.destruction_hash} style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', color: '#0D0D0D', background: 'rgba(0,0,0,0.04)', padding: '3px 8px', borderRadius: '4px', display: 'inline-block', maxWidth: isMobile ? '120px' : '340px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {e.destruction_hash}
                                                    </span>
                                                ) : <span style={{ color: 'rgba(0,0,0,0.3)', fontStyle: 'italic' }}>—</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Status Footer Ticker */}
                <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 40, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: '1px solid rgba(0,0,0,0.05)', height: '40px', display: 'flex', alignItems: 'center', paddingLeft: '32px', gap: '40px' }}>
                    {[
                        { dot: '#00F5A0', label: 'System Online' },
                        { dot: null, label: 'Data Confinement Active' },
                        { dot: null, label: 'MEI Framework v1.0' },
                    ].map(({ dot, label }) => (
                        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {dot && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: dot, display: 'inline-block' }} />}
                            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', fontFamily: "'Be Vietnam Pro', sans-serif" }}>{label}</span>
                        </div>
                    ))}
                </div>

            </div>
        </>
    );
}
