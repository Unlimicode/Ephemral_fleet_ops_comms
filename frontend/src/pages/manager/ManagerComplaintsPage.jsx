import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios.js';
import ManagerLayout from '../../components/layout/ManagerLayout.jsx';
import GlassCard from '../../components/layout/GlassCard.jsx';
import PageWrapper from '../../components/layout/PageWrapper.jsx';
import { useToast } from '../../components/Toast.jsx';

const CATEGORIES = {
    service_quality: { label: 'Service Quality', color: '#3B82F6' },
    driver_behaviour: { label: 'Driver Behaviour', color: '#F59E0B' },
    privacy_concern: { label: 'Privacy Concern', color: '#EF4444' },
    other: { label: 'Other', color: '#6B6B6B' }
};

const STATUSES = ['open', 'under_investigation', 'resolved', 'escalated'];

export default function ManagerComplaintsPage() {
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [filter, setFilter] = useState('All');
    const [expandedComplaintId, setExpandedComplaintId] = useState(null);
    const [messages, setMessages] = useState({});
    const [loadingMessages, setLoadingMessages] = useState({});
    const { addToast } = useToast();

    const fetchComplaints = useCallback(async () => {
        try {
            const res = await api.get('/complaints');
            setComplaints(Array.isArray(res.data) ? res.data : []);
            setError(false);
        } catch (err) {
            console.error('Failed to fetch complaints:', err);
            setError(true);
            addToast('error', 'Could not load complaints.');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchComplaints();
    }, [fetchComplaints]);

    async function handleStatusUpdate(complaintId, status) {
        try {
            await api.patch(`/complaints/${complaintId}/status`, { status });
            addToast('success', `Status updated to ${status.replace('_', ' ')}.`);
            fetchComplaints();
        } catch (err) {
            console.error('Failed to update status:', err);
            addToast('error', 'Failed to update status.');
        }
    }

    async function handleSaveNotes(complaintId, notes) {
        try {
            await api.patch(`/complaints/${complaintId}/notes`, { notes });
            addToast('success', 'Investigation notes saved.');
        } catch (err) {
            console.error('Failed to save notes:', err);
            addToast('error', 'Failed to save notes.');
        }
    }

    async function handleNotifyDriver(complaintId) {
        try {
            await api.post(`/complaints/${complaintId}/notify-driver`);
            addToast('success', 'Driver has been notified of the review.');
        } catch (err) {
            console.error('Failed to notify driver:', err);
            addToast('error', 'Failed to notify driver.');
        }
    }

    async function toggleMessages(complaintId, currentStatus) {
        if (expandedComplaintId === complaintId) {
            setExpandedComplaintId(null);
            return;
        }

        setExpandedComplaintId(complaintId);

        if (currentStatus !== 'under_investigation') return;
        if (messages[complaintId]) return;

        setLoadingMessages(prev => ({ ...prev, [complaintId]: true }));
        try {
            const res = await api.get(`/complaints/${complaintId}/messages`);
            setMessages(prev => ({ ...prev, [complaintId]: res.data.messages }));
        } catch (err) {
            addToast('error', err.response?.data?.error || 'Failed to fetch messages.');
        } finally {
            setLoadingMessages(prev => ({ ...prev, [complaintId]: false }));
        }
    }

    const filteredComplaints = (complaints || []).filter(c => {
        if (filter === 'All') return true;
        if (filter === 'Open') return c.status === 'open';
        if (filter === 'Under Investigation') return c.status === 'under_investigation';
        if (filter === 'Resolved') return c.status === 'resolved';
        if (filter === 'Escalated') return c.status === 'escalated';
        return true;
    });

    const openCount = (complaints || []).filter(c => c.status === 'open').length;

    if (error && complaints.length === 0) {
        return (
            <PageWrapper>
                <div style={{ textAlign: 'center', padding: '100px' }}>
                    <h2 style={{ color: '#EF4444' }}>Failed to load complaints</h2>
                    <button onClick={fetchComplaints} style={btnSecondaryStyle}>Retry</button>
                </div>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0D0D0D' }}>Complaints</h1>
                <span style={{
                    background: '#EF4444', color: '#FFF',
                    padding: '2px 10px', borderRadius: '50px',
                    fontSize: '12px', fontWeight: 700
                }}>
                    {openCount} Open
                </span>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
                {['All', 'Open', 'Under Investigation', 'Resolved', 'Escalated'].map(t => (
                    <button
                        key={t}
                        onClick={() => setFilter(t)}
                        style={{
                            padding: '8px 16px',
                            borderRadius: '10px',
                            border: 'none',
                            background: filter === t ? '#0D0D0D' : 'rgba(255,255,255,0.5)',
                            color: filter === t ? '#FFF' : '#6B6B6B',
                            fontWeight: 600,
                            fontSize: '13px',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {/* Complaint List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '60px', opacity: 0.5 }}>
                        <div className="spinner" style={{ margin: '0 auto 12px' }} />
                        Loading complaints...
                    </div>
                ) : filteredComplaints.length === 0 ? (
                    <GlassCard style={{ textAlign: 'center', padding: '60px', opacity: 0.5 }}>
                        No complaints found.
                    </GlassCard>
                ) : filteredComplaints.map(c => (
                    <ComplaintCard
                        key={c.complaint_id}
                        complaint={c}
                        isExpanded={expandedComplaintId === c.complaint_id}
                        onToggle={() => toggleMessages(c.complaint_id, c.status)}
                        onStatusUpdate={status => handleStatusUpdate(c.complaint_id, status)}
                        onSaveNotes={notes => handleSaveNotes(c.complaint_id, notes)}
                        onNotify={() => handleNotifyDriver(c.complaint_id)}
                        messages={messages[c.complaint_id]}
                        isLoadingMessages={loadingMessages[c.complaint_id]}
                    />
                ))}
            </div>
        </PageWrapper>
    );
}

function ComplaintCard({ complaint, isExpanded, onToggle, onStatusUpdate, onSaveNotes, onNotify, messages, isLoadingMessages }) {
    const cat = CATEGORIES[complaint.category] || CATEGORIES.other;
    const [localNotes, setLocalNotes] = useState(complaint.investigation_notes || '');

    return (
        <GlassCard style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                    <div style={{ fontSize: '12px', color: '#6B6B6B', marginBottom: '4px' }}>
                        Trip: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{complaint.trip_id}</span> • {new Date(complaint.created_at).toLocaleDateString()}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: '4px', background: cat.color + '20', color: cat.color, fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', margin: '4px' }}>
                            {cat.label}
                        </span>
                        <StatusBadge status={complaint.status} />
                    </div>
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0D0D0D' }}>
                    {complaint.organisation || 'Independent Client'}
                </div>
            </div>

            <p style={{ fontSize: '15px', color: '#1F2937', lineHeight: '1.6', marginBottom: '20px' }}>
                {complaint.description}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                {complaint.status !== 'resolved' && (
                    <button
                        onClick={onToggle}
                        style={btnSecondaryStyle}
                    >
                        {isExpanded ? 'Hide Details' : 'View Messages'}
                    </button>
                )}

                <div style={{ display: 'flex', gap: '6px' }}>
                    <select
                        defaultValue={complaint.status}
                        onChange={e => onStatusUpdate(e.target.value)}
                        style={{ ...inputStyle, padding: '8px 12px' }}
                    >
                        {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                    </select>
                </div>

                <button
                    onClick={onNotify}
                    style={{ ...btnSecondaryStyle, color: '#3B82F6', borderColor: 'rgba(59,130,246,0.2)' }}
                >
                    Notify Driver
                </button>
            </div>

            {isExpanded && (
                <div style={{ marginTop: '24px', borderTop: '1px solid rgba(0,0,0,0.05)', paddingTop: '24px' }}>
                    {/* Notes Section */}
                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 600, color: '#4B5563', display: 'block', marginBottom: '8px' }}>Investigation Notes</label>
                        <textarea
                            value={localNotes}
                            onChange={e => setLocalNotes(e.target.value)}
                            onBlur={() => onSaveNotes(localNotes)}
                            placeholder="Add internal investigation notes..."
                            style={{
                                width: '100%', minHeight: '100px',
                                padding: '12px', borderRadius: '10px',
                                border: '1px solid rgba(0,0,0,0.1)',
                                background: 'rgba(255,255,255,0.5)',
                                fontSize: '14px', fontFamily: 'inherit'
                            }}
                        />
                        <p style={{ fontSize: '11px', color: '#9CA3AF', marginTop: '4px' }}>Auto-saves on blur.</p>
                    </div>

                    {/* Messages Section */}
                    {complaint.status === 'under_investigation' ? (
                        <div>
                            <div style={{
                                background: 'rgba(245,158,11,0.1)',
                                borderLeft: '4px solid #F59E0B',
                                padding: '12px 16px',
                                borderRadius: '4px',
                                marginBottom: '16px',
                                fontSize: '13px'
                            }}>
                                ⚠️ <strong>Logged Access:</strong> You are viewing preserved communication records. This access has been logged to the audit trail.
                            </div>

                            {isLoadingMessages ? (
                                <p style={{ opacity: 0.5, fontSize: '14px' }}>Loading messages...</p>
                            ) : messages && messages.length > 0 ? (
                                <div style={{ background: 'rgba(0,0,0,0.02)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {messages.map((m, idx) => (
                                        <div key={idx} style={{
                                            maxWidth: '80%',
                                            alignSelf: m.role === 'driver' ? 'flex-start' : 'flex-end',
                                            padding: '8px 12px',
                                            borderRadius: '12px',
                                            background: m.role === 'driver' ? '#FFF' : '#3B82F6',
                                            color: m.role === 'driver' ? '#111827' : '#FFF',
                                            fontSize: '13px',
                                            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                        }}>
                                            <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '2px', textTransform: 'uppercase', fontWeight: 700 }}>{m.role}</div>
                                            {m.text}
                                            <div style={{ fontSize: '9px', opacity: 0.5, marginTop: '4px', textAlign: 'right' }}>{new Date(m.timestamp).toLocaleTimeString()}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p style={{ opacity: 0.5, fontSize: '14px' }}>No messages were exchanged during this trip.</p>
                            )}
                        </div>
                    ) : (
                        <p style={{ opacity: 0.5, fontSize: '13px', fontStyle: 'italic' }}>
                            Message contents are only accessible when status is "under investigation".
                        </p>
                    )}
                </div>
            )}
        </GlassCard>
    );
}

function StatusBadge({ status }) {
    const colors = {
        open: { bg: 'rgba(239,68,68,0.1)', fg: '#EF4444' },
        under_investigation: { bg: 'rgba(59,130,246,0.1)', fg: '#3B82F6' },
        resolved: { bg: 'rgba(16,185,129,0.1)', fg: '#10B981' },
        escalated: { bg: 'rgba(245,158,11,0.1)', fg: '#F59E0B' }
    };
    const c = colors[status] || colors.open;
    return (
        <span style={{
            fontSize: '11px', fontWeight: 700,
            padding: '2px 8px', borderRadius: '50px',
            background: c.bg, color: c.fg,
            textTransform: 'uppercase',
            margin: '4px',
            display: 'inline-block'
        }}>
            {status.replace('_', ' ')}
        </span>
    );
}

const inputStyle = { padding: '12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', fontSize: '14px' };
const btnSecondaryStyle = { padding: '8px 16px', background: 'transparent', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '10px', fontWeight: 600, cursor: 'pointer', fontSize: '13px' };
