import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios.js';
import ManagerLayout from '../../components/layout/ManagerLayout.jsx';
import GlassCard from '../../components/layout/GlassCard.jsx';
import PageWrapper from '../../components/layout/PageWrapper.jsx';
import { useToast } from '../../components/Toast.jsx';

const ACTION_TYPES = [
    'DRIVER_ADDED', 'DRIVER_DEACTIVATED', 'VEHICLE_ADDED', 'VEHICLE_REMOVED',
    'TRIP_ASSIGNED', 'TRIP_ACCEPTED', 'TRIP_COMPLETED', 'TRIP_SESSION_DESTROYED',
    'COMPLAINT_FILED', 'COMPLAINT_VIEWED', 'COMPLAINT_STATUS_UPDATED',
    'MESSAGE_ARCHIVE_ACCESSED', 'AUDIT_EXPORTED', 'DRIVER_NOTIFIED_OF_REVIEW'
];

export default function ManagerAuditPage() {
    const [entries, setEntries] = useState([]);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(false);
    const [offset, setOffset] = useState(0);
    const [filters, setFilters] = useState({ action_type: '', search: '', from: '', to: '' });
    const { addToast } = useToast();

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
        }, 300); // Debounce search
        return () => {
            clearTimeout(timer);
        };
    }, [filters.search, filters.action_type, filters.from, filters.to, fetchAudit]);

    const handleExportAuditCSV = async () => {
        try {
            const res = await api.get('/roster/audit', {
                params: { limit: 10000, offset: 0 }
            });
            const entries = res.data.entries || [];

            const headers = ['Timestamp', 'Action Type', 'Actor Role', 'Actor ID', 'Target ID', 'Details'];
            const rows = entries.map(e => [
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

    return (
        <PageWrapper>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h1 className="kinetic-text reveal-up" style={{ fontSize: '24px', fontWeight: 800, color: '#0D0D0D' }}>Audit Trail</h1>
            </div>

            {/* Filters Row */}
            <GlassCard style={{ padding: '20px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                    <button onClick={handleExportAuditCSV} style={btnSecondaryStyle}>
                        Export CSV
                    </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                    <div style={filterGroup}>
                        <label style={filterLabel}>Search</label>
                        <input
                            type="text"
                            placeholder="Actor ID or keyword..."
                            value={filters.search}
                            onChange={e => setFilters({ ...filters, search: e.target.value })}
                            style={inputStyle}
                        />
                    </div>
                    <div style={filterGroup}>
                        <label style={filterLabel}>Action Type</label>
                        <select
                            value={filters.action_type}
                            onChange={e => setFilters({ ...filters, action_type: e.target.value })}
                            style={inputStyle}
                        >
                            <option value="">All Actions</option>
                            {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                    <div style={filterGroup}>
                        <label style={filterLabel}>From Date</label>
                        <input
                            type="date"
                            value={filters.from}
                            onChange={e => setFilters({ ...filters, from: e.target.value })}
                            style={inputStyle}
                        />
                    </div>
                    <div style={filterGroup}>
                        <label style={filterLabel}>To Date</label>
                        <input
                            type="date"
                            value={filters.to}
                            onChange={e => setFilters({ ...filters, to: e.target.value })}
                            style={inputStyle}
                        />
                    </div>
                </div>
            </GlassCard>

            {/* Audit Table */}
            <GlassCard style={{ padding: '0', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                    <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                            <th style={thStyle}>Timestamp</th>
                            <th style={thStyle}>Action</th>
                            <th style={thStyle}>Actor</th>
                            <th style={thStyle}>Target</th>
                            <th style={thStyle}>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading && entries.length === 0 ? (
                            <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center' }}>
                                <div className="spinner" style={{ margin: '0 auto 12px' }} />
                                <span style={{ opacity: 0.5 }}>Loading logs...</span>
                            </td></tr>
                        ) : error && entries.length === 0 ? (
                            <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center' }}>
                                <h3 style={{ color: '#EF4444', marginBottom: '12px' }}>Failed to load audit logs</h3>
                                <button onClick={() => fetchAudit()} style={btnSecondaryStyle}>Retry</button>
                            </td></tr>
                        ) : entries.length === 0 ? (
                            <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center', opacity: 0.5 }}>No entries found.</td></tr>
                        ) : entries.map(entry => (
                            <tr key={entry.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.02)' }}>
                                <td style={{ ...tdStyle, whiteSpace: 'nowrap', opacity: 0.7 }}>
                                    {new Date(entry.timestamp).toLocaleString()}
                                </td>
                                <td style={tdStyle}>
                                    <ActionBadge type={entry.action_type} />
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, opacity: 0.5 }}>{entry.actor_role}</div>
                                    <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>{entry.actor_id}</div>
                                </td>
                                <td style={tdStyle}>
                                    <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>{entry.target_id || '—'}</div>
                                </td>
                                <td style={{ ...tdStyle, maxWidth: '300px' }}>
                                    <pre style={{
                                        margin: 0, padding: '8px',
                                        background: 'rgba(0,0,0,0.03)',
                                        borderRadius: '6px',
                                        fontSize: '11px',
                                        overflowX: 'auto',
                                        maxHeight: '100px'
                                    }}>
                                        {JSON.stringify(entry.details, null, 2)}
                                    </pre>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </GlassCard>

            {/* Load More */}
            {entries.length < totalCount && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}>
                    <button
                        onClick={() => fetchAudit(true)}
                        disabled={loadingMore}
                        style={{
                            ...btnSecondaryStyle,
                            padding: '12px 32px',
                            opacity: loadingMore ? 0.5 : 1
                        }}
                    >
                        {loadingMore ? 'Loading...' : `Load More (${totalCount - entries.length} remaining)`}
                    </button>
                </div>
            )}
        </PageWrapper>
    );
}

function ActionBadge({ type }) {
    let color = '#6B6B6B';
    if (type.includes('ADDED') || type.includes('ACCEPTED')) color = '#10B981';
    if (type.includes('REMOVED') || type.includes('DEACTIVATED')) color = '#EF4444';
    if (type.includes('COMPLAINT') || type.includes('ACCESSED')) color = '#F59E0B';
    if (type.includes('TRIP')) color = '#3B82F6';
    if (type.includes('EXPORTED')) color = '#8B5CF6';

    return (
        <span style={{
            fontSize: '10px', fontWeight: 800,
            padding: '3px 10px', borderRadius: '6px',
            background: color + '15', color: color,
            border: `1px solid ${color}30`,
            display: 'inline-block',
            whiteSpace: 'nowrap'
        }}>
            {type}
        </span>
    );
}

const thStyle = { padding: '16px', fontSize: '13px', fontWeight: 600, color: '#6B6B6B' };
const tdStyle = { padding: '16px', verticalAlign: 'top' };
const inputStyle = { padding: '10px', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', fontSize: '13px', width: '100%' };
const btnSecondaryStyle = { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'rgba(255,255,255,0.5)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', fontSize: '14px', transition: 'all 0.2s' };
const filterGroup = { display: 'flex', flexDirection: 'column', gap: '6px' };
const filterLabel = { fontSize: '12px', fontWeight: 700, color: '#6B6B6B', textTransform: 'uppercase' };
