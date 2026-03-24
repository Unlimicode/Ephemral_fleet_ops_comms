import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios.js';
import { useToast } from '../../components/Toast.jsx';
import useWindowWidth from '../../hooks/useWindowWidth.js';

const ACTION_TYPES = [
    'DRIVER_ADDED', 'DRIVER_DEACTIVATED', 'VEHICLE_ADDED', 'VEHICLE_REMOVED',
    'TRIP_ASSIGNED', 'TRIP_ACCEPTED', 'TRIP_COMPLETED', 'TRIP_SESSION_DESTROYED',
    'COMPLAINT_FILED', 'COMPLAINT_VIEWED', 'COMPLAINT_STATUS_UPDATED',
    'MESSAGE_ARCHIVE_ACCESSED', 'AUDIT_EXPORTED', 'DRIVER_NOTIFIED_OF_REVIEW'
];

function ActionBadge({ type }) {
    let color = '#6B6B6B';
    if (type.includes('ADDED') || type.includes('ACCEPTED')) color = '#10B981';
    if (type.includes('REMOVED') || type.includes('DEACTIVATED')) color = '#EF4444';
    if (type.includes('COMPLAINT') || type.includes('ACCESSED')) color = '#F59E0B';
    if (type.includes('TRIP')) color = '#3B82F6';
    if (type.includes('EXPORTED')) color = '#8B5CF6';

    return (
        <span style={{
            background: color + '15',
            color,
            borderRadius: '999px',
            padding: '4px 12px',
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            display: 'inline-block',
            whiteSpace: 'nowrap',
            fontFamily: "'Be Vietnam Pro', sans-serif"
        }}>
            {type.replace(/_/g, ' ')}
        </span>
    );
}

export default function ManagerAuditPage() {
    const [entries, setEntries] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(false);
    const [offset, setOffset] = useState(0);
    const [filters, setFilters] = useState({ action_type: '', search: '', from: '', to: '' });
    const { addToast } = useToast();
    const width = useWindowWidth();
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;

    const fetchAudit = useCallback(async (isLoadMore = false) => {
        const newOffset = isLoadMore ? offset + 50 : 0;
        if (!isLoadMore) setLoading(true);
        else setLoadingMore(true);

        try {
            const params = {
                action_type: filters.action_type,
                search: filters.search,
                from: filters.from,
                to: filters.to,
                limit: 50,
                offset: newOffset
            };
            const res = await api.get('/roster/audit', { params });

            const newEntries = Array.isArray(res.data.entries) ? res.data.entries : [];
            if (isLoadMore) {
                setEntries(prev => [...prev, ...newEntries]);
            } else {
                setEntries(newEntries);
            }

            setTotalCount(res.data.total_count || 0);
            setOffset(newOffset);
            setError(false);
        } catch (err) {
            console.error('Failed to fetch audit logs:', err);
            setError(true);
            addToast('Could not load audit trail.', 'error');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [filters, offset, addToast]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchAudit();
        }, 300);
        return () => {
            clearTimeout(timer);
        };
    }, [filters.search, filters.action_type, filters.from, filters.to, fetchAudit]);

    const handleExportAuditCSV = async () => {
        try {
            const res = await api.get('/roster/audit', {
                params: { limit: 10000, offset: 0 }
            });
            const allEntries = res.data.entries || [];

            const headers = ['Timestamp', 'Action Type', 'Actor Role', 'Actor ID', 'Target ID', 'Details'];
            const rows = allEntries.map(e => [
                new Date(e.timestamp).toLocaleString(),
                e.action_type,
                e.actor_role,
                e.actor_id,
                e.target_id || '—',
                JSON.stringify(e.details || {})
            ]);

            const csv = [headers, ...rows]
                .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
                .join('\n');

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `swiftlink-audit-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Audit CSV export failed', err);
        }
    };

    const formatTimestamp = (iso) => {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ', ' +
            d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    const securityEventCount = entries.filter(e =>
        e.action_type.includes('DEACTIVATED') || e.action_type.includes('REMOVED')
    ).length;

    const rolePillStyle = (role) => {
        if (role === 'manager') return { background: 'rgba(108,99,255,0.1)', color: '#6C63FF' };
        if (role === 'driver') return { background: 'rgba(0,212,255,0.1)', color: '#00B4FF' };
        if (role === 'client') return { background: 'rgba(0,245,160,0.1)', color: '#00A86B' };
        return { background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.5)' };
    };

    return (
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '1440px', margin: '0 auto', padding: isMobile ? '16px' : isTablet ? '16px 24px' : '20px 32px', fontFamily: "'Be Vietnam Pro', sans-serif" }}>
            <style>{`
                .audit-panel {
                    background: rgba(255,255,255,0.40);
                    backdrop-filter: blur(40px) saturate(180%);
                    -webkit-backdrop-filter: blur(40px) saturate(180%);
                    border: 1px solid rgba(255,255,255,0.6);
                    box-shadow: 0 20px 60px rgba(0,0,0,0.06);
                    border-radius: 2rem;
                }
                .audit-stat-card {
                    background: rgba(255,255,255,0.55);
                    backdrop-filter: blur(40px) saturate(180%);
                    -webkit-backdrop-filter: blur(40px) saturate(180%);
                    border: 1px solid rgba(255,255,255,0.7);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9);
                    border-radius: 1.5rem;
                    transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1);
                }
                .audit-stat-card:hover { transform: translateY(-4px); }
                .table-row:hover { background: rgba(255,255,255,0.4); }
                .search-input:focus { box-shadow: 0 0 0 2px rgba(108,99,255,0.3); }
                .export-btn:hover { transform: translateY(-2px); }
                @keyframes float-slow {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-30px) rotate(8deg); }
                }
                @keyframes float-reverse {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(20px) rotate(-6deg); }
                }
                .geo-float-1 { animation: float-slow 11s ease-in-out infinite; }
                .geo-float-2 { animation: float-reverse 9s ease-in-out infinite; }
            `}</style>

            {/* Fixed Background */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                <div style={{
                    position: 'absolute', inset: 0, opacity: 0.4,
                    backgroundImage: 'linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)',
                    backgroundSize: '80px 80px'
                }} />
                <div className="geo-float-1" style={{ position: 'absolute', top: '15%', left: '3%', color: 'rgba(108,99,255,0.10)' }}>
                    <div style={{ width: 0, height: 0, borderLeft: '60px solid transparent', borderRight: '60px solid transparent', borderBottom: '104px solid currentColor', transform: 'scale(2) rotate(12deg)' }} />
                </div>
                <div className="geo-float-2" style={{ position: 'absolute', bottom: '10%', right: '6%', color: 'rgba(108,99,255,0.08)' }}>
                    <div style={{ width: 0, height: 0, borderLeft: '60px solid transparent', borderRight: '60px solid transparent', borderBottom: '104px solid currentColor', transform: 'scale(1.5) rotate(-15deg)' }} />
                </div>
            </div>

            {/* Loading State */}
            {loading && entries.length === 0 && (
                <>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '20px', marginBottom: '40px' }}>
                        {[...Array(4)].map((_, i) => (
                            <div key={i} className="audit-stat-card" style={{ padding: '24px', height: '110px', background: 'rgba(255,255,255,0.4)' }}>
                                <div style={{ height: '10px', width: '50%', background: 'rgba(0,0,0,0.06)', borderRadius: '6px', marginBottom: '16px' }} />
                                <div style={{ height: '28px', width: '40%', background: 'rgba(0,0,0,0.06)', borderRadius: '6px' }} />
                            </div>
                        ))}
                    </div>
                    <div className="audit-panel" style={{ height: '400px', background: 'rgba(255,255,255,0.3)' }} />
                </>
            )}

            {/* Error State */}
            {error && entries.length === 0 && (
                <div className="audit-stat-card" style={{ padding: '48px', textAlign: 'center', borderLeft: '3px solid #E05A5A' }}>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: '#E05A5A', marginBottom: '16px' }}>Failed to load audit trail</p>
                    <button
                        onClick={() => fetchAudit()}
                        style={{ background: '#E05A5A', color: 'white', borderRadius: '999px', padding: '10px 24px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Main Content */}
            {(!loading || entries.length > 0) && !error && (
                <>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '40px', flexWrap: 'wrap', gap: '24px' }}>
                        <div>
                            <h1 style={{ fontSize: isMobile ? '36px' : '56px', fontWeight: 900, letterSpacing: '-0.03em', textTransform: 'uppercase', color: '#0D0D0D', lineHeight: 1, margin: 0 }}>
                                Audit Trail
                            </h1>
                            <p style={{ fontSize: '14px', color: 'rgba(0,0,0,0.5)', fontWeight: 500, marginTop: '12px', maxWidth: '480px', margin: '12px 0 0 0' }}>
                                Comprehensive system event monitoring and regulatory compliance logs.
                            </p>
                        </div>
                        <button
                            className="export-btn"
                            onClick={handleExportAuditCSV}
                            style={{ background: '#6C63FF', color: 'white', borderRadius: '999px', padding: '12px 28px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 20px rgba(108,99,255,0.3)', transition: 'transform 0.2s ease', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>download</span>
                            Export CSV
                        </button>
                    </div>

                    {/* Stat Tiles */}
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: '20px', marginBottom: '40px' }}>
                        {/* Total Logs */}
                        <div className="audit-stat-card" style={{ padding: '24px' }}>
                            <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(0,0,0,0.4)', fontWeight: 700, margin: 0 }}>Total Logs</p>
                            <p style={{ fontSize: '32px', fontWeight: 900, color: '#0D0D0D', letterSpacing: '-0.03em', margin: '8px 0 8px 0' }}>{totalCount.toLocaleString()}</p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '16px', color: '#00D188' }}>trending_up</span>
                                <span style={{ fontSize: '11px', color: '#00D188', fontWeight: 700 }}>+live</span>
                            </div>
                        </div>

                        {/* Security Events */}
                        <div className="audit-stat-card" style={{ padding: '24px', borderLeft: '3px solid #E05A5A' }}>
                            <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(0,0,0,0.4)', fontWeight: 700, margin: 0 }}>Security Events</p>
                            <p style={{ fontSize: '32px', fontWeight: 900, color: '#E05A5A', letterSpacing: '-0.03em', margin: '8px 0 8px 0' }}>{securityEventCount}</p>
                            <p style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)', margin: 0 }}>in current view</p>
                        </div>

                        {/* Compliance Score */}
                        <div className="audit-stat-card" style={{ padding: '24px' }}>
                            <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(0,0,0,0.4)', fontWeight: 700, margin: 0 }}>Compliance Score</p>
                            <p style={{ fontSize: '32px', fontWeight: 900, color: '#6C63FF', letterSpacing: '-0.03em', margin: '8px 0 12px 0' }}>98.4%</p>
                            <div style={{ width: '100%', height: '4px', background: 'rgba(0,0,0,0.06)', borderRadius: '999px' }}>
                                <div style={{ width: '98.4%', height: '100%', background: 'linear-gradient(90deg, #6C63FF, #00D4FF)', borderRadius: '999px' }} />
                            </div>
                        </div>

                        {/* Action Types */}
                        <div className="audit-stat-card" style={{ padding: '24px' }}>
                            <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', color: 'rgba(0,0,0,0.4)', fontWeight: 700, margin: 0 }}>Action Types</p>
                            <p style={{ fontSize: '32px', fontWeight: 900, color: '#0D0D0D', letterSpacing: '-0.03em', margin: '8px 0 8px 0' }}>{ACTION_TYPES.length}</p>
                            <p style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)', margin: 0 }}>tracked events</p>
                        </div>
                    </div>

                    {/* Audit Table Panel */}
                    <div className="audit-panel" style={{ overflow: 'hidden' }}>
                        {/* Table Controls */}
                        <div style={{ padding: '32px', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.2)' }}>
                            {/* Search */}
                            <div style={{ position: 'relative', flex: 1, minWidth: '280px' }}>
                                <span className="material-symbols-outlined" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'rgba(0,0,0,0.3)', fontSize: '20px', pointerEvents: 'none' }}>search</span>
                                <input
                                    className="search-input"
                                    type="text"
                                    placeholder="Search by actor ID, target ID, or action..."
                                    value={filters.search}
                                    onChange={e => setFilters({ ...filters, search: e.target.value })}
                                    style={{ width: '100%', background: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '999px', padding: '12px 16px 12px 48px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                />
                            </div>

                            {/* Filter Controls */}
                            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                <div>
                                    <p style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.3em', fontWeight: 700, color: 'rgba(0,0,0,0.4)', marginBottom: '4px', margin: '0 0 4px 0' }}>Action Type</p>
                                    <select
                                        value={filters.action_type}
                                        onChange={e => setFilters({ ...filters, action_type: e.target.value })}
                                        style={{ background: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '999px', padding: '10px 20px', fontSize: '12px', fontWeight: 700, color: '#0D0D0D', outline: 'none', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                    >
                                        <option value="">All Actions</option>
                                        {ACTION_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                                    </select>
                                </div>

                                <div>
                                    <p style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.3em', fontWeight: 700, color: 'rgba(0,0,0,0.4)', margin: '0 0 4px 0' }}>From Date</p>
                                    <input
                                        type="date"
                                        value={filters.from}
                                        onChange={e => setFilters({ ...filters, from: e.target.value })}
                                        style={{ background: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '999px', padding: '10px 20px', fontSize: '12px', fontWeight: 700, color: '#0D0D0D', outline: 'none', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                    />
                                </div>

                                <div>
                                    <p style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.3em', fontWeight: 700, color: 'rgba(0,0,0,0.4)', margin: '0 0 4px 0' }}>To Date</p>
                                    <input
                                        type="date"
                                        value={filters.to}
                                        onChange={e => setFilters({ ...filters, to: e.target.value })}
                                        style={{ background: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: '999px', padding: '10px 20px', fontSize: '12px', fontWeight: 700, color: '#0D0D0D', outline: 'none', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Table */}
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(0,0,0,0.03)' }}>
                                        {['Timestamp', 'Action', 'Actor Role', 'Target ID', 'Details'].map(col => (
                                            <th key={col} style={{ padding: '20px 32px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', textAlign: 'left' }}>
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.length === 0 && !loading ? (
                                        <tr>
                                            <td colSpan={5} style={{ textAlign: 'center', padding: '48px' }}>
                                                <span style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(0,0,0,0.3)' }}>No audit entries found</span>
                                            </td>
                                        </tr>
                                    ) : entries.map(entry => (
                                        <tr key={entry.id} className="table-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.15)', transition: 'background 0.15s ease' }}>
                                            <td style={{ padding: '18px 32px', fontSize: '13px', fontWeight: 500, color: 'rgba(0,0,0,0.6)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
                                                {formatTimestamp(entry.timestamp)}
                                            </td>
                                            <td style={{ padding: '18px 32px' }}>
                                                <ActionBadge type={entry.action_type} />
                                            </td>
                                            <td style={{ padding: '18px 32px' }}>
                                                <span style={{ ...rolePillStyle(entry.actor_role), borderRadius: '999px', padding: '4px 10px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', display: 'inline-block' }}>
                                                    {entry.actor_role}
                                                </span>
                                                <div style={{ fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', color: 'rgba(0,0,0,0.3)', marginTop: '2px' }}>
                                                    {entry.actor_id ? entry.actor_id.slice(0, 8) + '...' : '—'}
                                                </div>
                                            </td>
                                            <td style={{ padding: '18px 32px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: 'rgba(0,0,0,0.45)' }}>
                                                {entry.target_id ? entry.target_id.slice(0, 8) + '...' : '—'}
                                            </td>
                                            <td style={{ padding: '18px 32px', fontSize: '12px', color: 'rgba(0,0,0,0.45)', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {entry.details ? JSON.stringify(entry.details).slice(0, 60) + '...' : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        <div style={{ padding: '24px 32px', borderTop: '1px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,0,0,0.4)' }}>
                                Showing {entries.length} of {totalCount.toLocaleString()} entries
                            </span>
                            {entries.length < totalCount && (
                                <button
                                    onClick={() => fetchAudit(true)}
                                    disabled={loadingMore}
                                    style={{ background: 'rgba(108,99,255,0.1)', color: '#6C63FF', borderRadius: '999px', padding: '10px 24px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: loadingMore ? 'not-allowed' : 'pointer', opacity: loadingMore ? 0.6 : 1, fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                >
                                    {loadingMore ? 'Loading...' : 'Load More'}
                                </button>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
