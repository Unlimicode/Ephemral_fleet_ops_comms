import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
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
            const res = await axios.get('/api/roster/audit', { params });

            if (isLoadMore) {
                setEntries(prev => [...prev, ...res.data.entries]);
            } else {
                setEntries(res.data.entries);
            }

            setTotalCount(res.data.total_count);
            setOffset(newOffset);
        } catch (err) {
            console.error('Failed to fetch audit logs:', err);
            addToast('error', 'Could not load audit trail.');
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [filters, offset, addToast]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchAudit();
        }, 300); // Debounce search
        return () => clearTimeout(timer);
    }, [filters.search, filters.action_type, filters.from, filters.to, fetchAudit]); // Only trigger on filter changes

    async function handleExport() {
        try {
            addToast('info', 'Preparing export...');
            const response = await axios({
                url: '/api/roster/audit/export',
                method: 'GET',
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `audit_trail_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            addToast('success', 'Export successful.');
        } catch (err) {
            console.error('Export failed:', err);
            addToast('error', 'Export failed.');
        }
    }

    return (
        <ManagerLayout>
            <PageWrapper>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0D0D0D' }}>Audit Trail</h1>
                    <button
                        onClick={handleExport}
                        style={btnSecondaryStyle}
                    >
                        📥 Export CSV
                    </button>
                </div>

                {/* Filters Row */}
                <GlassCard style={{ padding: '20px', marginBottom: '24px' }}>
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
                            {loading ? (
                                <tr><td colSpan="5" style={{ padding: '40px', textAlign: 'center', opacity: 0.5 }}>Loading logs...</td></tr>
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
        </ManagerLayout>
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
            padding: '2px 8px', borderRadius: '4px',
            background: color + '15', color: color,
            border: `1px solid ${color}30`
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
