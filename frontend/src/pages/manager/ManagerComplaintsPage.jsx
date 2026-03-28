import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios.js';
import { useToast } from '../../components/Toast.jsx';
import useWindowWidth from '../../hooks/useWindowWidth.js';

const STATUSES = ['open', 'under_investigation', 'resolved', 'escalated'];

export default function ManagerComplaintsPage() {
    const [complaints, setComplaints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [filter, setFilter] = useState('All');
    const [expandedComplaintId, setExpandedComplaintId] = useState(null);
    const [messages, setMessages] = useState({});
    const [loadingMessages, setLoadingMessages] = useState({});
    const [localNotes, setLocalNotes] = useState({});
    const { addToast } = useToast();
    const width = useWindowWidth();
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;

    const fetchComplaints = useCallback(async () => {
        try {
            const res = await api.get('/complaints');
            setComplaints(Array.isArray(res.data) ? res.data : []);
            setError(false);
        } catch (err) {
            console.error('Failed to fetch complaints:', err);
            setError(true);
            addToast('Could not load complaints.', 'error');
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
            addToast(`Status updated to ${status.replace('_', ' ')}.`, 'success');
            fetchComplaints();
        } catch (err) {
            console.error('Failed to update status:', err);
            addToast('Failed to update status.', 'error');
        }
    }

    async function handleSaveNotes(complaintId, notes) {
        try {
            await api.patch(`/complaints/${complaintId}/notes`, { notes });
            addToast('Investigation notes saved.', 'success');
        } catch (err) {
            console.error('Failed to save notes:', err);
            addToast('Failed to save notes.', 'error');
        }
    }

    async function handleNotifyDriver(complaintId) {
        try {
            await api.post(`/complaints/${complaintId}/notify-driver`);
            addToast('Driver has been notified of the review.', 'success');
        } catch (err) {
            console.error('Failed to notify driver:', err);
            addToast('Failed to notify driver.', 'error');
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
            addToast(err.response?.data?.error || 'Failed to fetch messages.', 'error');
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

    const statusColor = (status) => {
        if (status === 'open') return '#F59E0B';
        if (status === 'under_investigation') return '#6C63FF';
        if (status === 'resolved') return '#00F5A0';
        if (status === 'escalated') return '#E05A5A';
        return '#A0A0A0';
    };

    const statusLabel = (status) => {
        if (status === 'under_investigation') return 'Under Investigation';
        return status.charAt(0).toUpperCase() + status.slice(1);
    };

    const categoryLabel = (cat) => {
        if (!cat) return 'Other';
        return cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    };

    const formatDate = (iso) => {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const tabCounts = {
        'All': complaints.length,
        'Open': complaints.filter(c => c.status === 'open').length,
        'Under Investigation': complaints.filter(c => c.status === 'under_investigation').length,
        'Resolved': complaints.filter(c => c.status === 'resolved').length,
        'Escalated': complaints.filter(c => c.status === 'escalated').length,
    };

    return (
        <div style={{ position: 'relative', zIndex: 1, maxWidth: '1440px', margin: '0 auto', padding: isMobile ? '16px' : isTablet ? '16px 24px' : '20px 32px', fontFamily: "'Be Vietnam Pro', sans-serif" }}>
            <style>{`
                .complaint-card {
                    background: rgba(255,255,255,0.55);
                    backdrop-filter: blur(40px) saturate(180%);
                    -webkit-backdrop-filter: blur(40px) saturate(180%);
                    border: 1px solid rgba(255,255,255,0.7);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9);
                    border-radius: 2rem;
                    transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease;
                }
                .complaint-card:hover {
                    transform: translateY(-4px);
                    box-shadow: 0 16px 48px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.95);
                }
                .micro-label {
                    font-size: 10px;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                }
                .notes-textarea:focus {
                    border-color: rgba(108,99,255,0.4) !important;
                    outline: none;
                }
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

            {/* Header */}
            <div style={{ marginBottom: '40px' }}>
                <p className="micro-label" style={{ color: '#6C63FF', fontWeight: 700, marginBottom: '8px' }}>Central Operations</p>
                <h1 style={{ fontSize: isMobile ? '36px' : '56px', fontWeight: 900, letterSpacing: '-0.03em', textTransform: 'uppercase', color: '#0D0D0D', margin: 0 }}>
                    Complaint Hub
                </h1>
            </div>

            {/* Loading State */}
            {loading && (
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: '24px' }}>
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="complaint-card" style={{ padding: '28px', height: '200px', background: 'rgba(255,255,255,0.4)' }}>
                            <div style={{ height: '12px', width: '40%', background: 'rgba(0,0,0,0.06)', borderRadius: '6px', marginBottom: '16px' }} />
                            <div style={{ height: '20px', width: '70%', background: 'rgba(0,0,0,0.06)', borderRadius: '6px', marginBottom: '12px' }} />
                            <div style={{ height: '14px', width: '90%', background: 'rgba(0,0,0,0.06)', borderRadius: '6px', marginBottom: '8px' }} />
                            <div style={{ height: '14px', width: '60%', background: 'rgba(0,0,0,0.06)', borderRadius: '6px' }} />
                        </div>
                    ))}
                </div>
            )}

            {/* Error State */}
            {error && complaints.length === 0 && (
                <div className="complaint-card" style={{ padding: '48px', textAlign: 'center', borderLeft: '3px solid #E05A5A' }}>
                    <p style={{ fontSize: '15px', fontWeight: 600, color: '#E05A5A', marginBottom: '16px' }}>Failed to load complaints</p>
                    <button
                        onClick={fetchComplaints}
                        style={{ background: '#E05A5A', color: 'white', borderRadius: '999px', padding: '10px 24px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer' }}
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* Main Content */}
            {!loading && !error && (
                <>
                    {/* Filter Tabs */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginBottom: '40px' }}>
                        {['All', 'Open', 'Under Investigation', 'Resolved', 'Escalated'].map(tab => {
                            const isActive = filter === tab;
                            return (
                                <button
                                    key={tab}
                                    onClick={() => setFilter(tab)}
                                    style={isActive ? {
                                        background: '#6C63FF', color: 'white', borderRadius: '999px',
                                        padding: '10px 20px', fontWeight: 700, fontSize: '13px',
                                        border: 'none', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif"
                                    } : {
                                        background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(20px)',
                                        border: '1px solid rgba(255,255,255,0.8)', color: 'rgba(0,0,0,0.6)',
                                        borderRadius: '999px', padding: '10px 20px', fontWeight: 600,
                                        fontSize: '13px', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif"
                                    }}
                                >
                                    {tab}
                                    <span style={isActive ? {
                                        background: 'rgba(255,255,255,0.2)', color: 'white',
                                        borderRadius: '999px', padding: '2px 8px', fontSize: '11px', marginLeft: '6px'
                                    } : {
                                        background: 'rgba(0,0,0,0.06)', borderRadius: '999px',
                                        padding: '2px 8px', fontSize: '11px', marginLeft: '6px'
                                    }}>
                                        {tabCounts[tab]}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Bento Grid */}
                    {filteredComplaints.length === 0 ? (
                        <div className="complaint-card" style={{ padding: '48px', textAlign: 'center' }}>
                            <p style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(0,0,0,0.3)' }}>
                                No complaints{filter !== 'All' ? ` · ${filter}` : ''}
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2,1fr)' : 'repeat(3,1fr)', gap: '24px' }}>
                            {filteredComplaints.map(c => {
                                const isExpanded = expandedComplaintId === c.complaint_id && c.status === 'under_investigation';

                                if (isExpanded) {
                                    return (
                                        <div
                                            key={c.complaint_id}
                                            className="complaint-card"
                                            style={{ gridColumn: isMobile ? 'span 1' : 'span 2', padding: '32px' }}
                                        >
                                            {/* Expanded Header */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                                <span className="micro-label" style={{ color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>
                                                    #{c.complaint_id.slice(0, 8)}
                                                </span>
                                                <span style={{ background: '#6C63FF', color: 'white', borderRadius: '999px', padding: '4px 12px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase' }}>
                                                    Under Investigation
                                                </span>
                                            </div>
                                            <h2 style={{ fontSize: '22px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', color: '#0D0D0D', margin: '0 0 4px 0' }}>
                                                {c.organisation || 'Independent Client'}
                                            </h2>
                                            <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.4)', margin: 0 }}>{formatDate(c.created_at)}</p>

                                            {/* Two Column Body */}
                                            <div style={{
                                                display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '24px',
                                                borderTop: '1px solid rgba(0,0,0,0.06)', marginTop: '24px', paddingTop: '24px'
                                            }}>
                                                {/* Left — Message Archive */}
                                                <div>
                                                    <p className="micro-label" style={{ color: '#6C63FF', fontWeight: 700, marginBottom: '16px' }}>Message Archive</p>
                                                    {loadingMessages[c.complaint_id] ? (
                                                        <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.4)' }}>Loading messages…</p>
                                                    ) : messages[c.complaint_id] && messages[c.complaint_id].length > 0 ? (
                                                        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                                            {messages[c.complaint_id].map((m, idx) => (
                                                                m.from === 'driver' ? (
                                                                    <div key={idx} style={{ background: 'rgba(108,99,255,0.06)', borderRadius: '16px', padding: '12px 16px', marginBottom: '10px', marginLeft: '16px' }}>
                                                                        <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: '#6C63FF', marginBottom: '4px', margin: '0 0 4px 0' }}>Driver</p>
                                                                        <p style={{ fontSize: '13px', color: '#0D0D0D', margin: '0 0 4px 0' }}>{m.content}</p>
                                                                        <p style={{ fontSize: '10px', color: 'rgba(0,0,0,0.35)', margin: 0 }}>{new Date(m.timestamp).toLocaleTimeString()}</p>
                                                                    </div>
                                                                ) : (
                                                                    <div key={idx} style={{ background: 'rgba(255,255,255,0.5)', borderRadius: '16px', padding: '12px 16px', marginBottom: '10px' }}>
                                                                        <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', marginBottom: '4px', margin: '0 0 4px 0' }}>Client</p>
                                                                        <p style={{ fontSize: '13px', color: '#0D0D0D', margin: '0 0 4px 0' }}>{m.content}</p>
                                                                        <p style={{ fontSize: '10px', color: 'rgba(0,0,0,0.35)', margin: 0 }}>{new Date(m.timestamp).toLocaleTimeString()}</p>
                                                                    </div>
                                                                )
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p style={{ fontSize: '12px', color: 'rgba(0,0,0,0.35)', textAlign: 'center', padding: '24px' }}>
                                                            No message archive available
                                                        </p>
                                                    )}
                                                </div>

                                                {/* Right — Investigation Notes + Actions */}
                                                <div>
                                                    <p className="micro-label" style={{ color: '#6C63FF', fontWeight: 700, marginBottom: '16px' }}>Investigation Notes</p>
                                                    <textarea
                                                        className="notes-textarea"
                                                        value={localNotes[c.complaint_id] !== undefined ? localNotes[c.complaint_id] : (c.investigation_notes || '')}
                                                        onChange={e => setLocalNotes(prev => ({ ...prev, [c.complaint_id]: e.target.value }))}
                                                        onBlur={() => handleSaveNotes(c.complaint_id, localNotes[c.complaint_id] !== undefined ? localNotes[c.complaint_id] : (c.investigation_notes || ''))}
                                                        placeholder="Add internal investigation notes…"
                                                        style={{
                                                            width: '100%', background: 'rgba(255,255,255,0.5)',
                                                            border: '1px solid rgba(0,0,0,0.08)', borderRadius: '16px',
                                                            padding: '16px', fontSize: '13px', outline: 'none',
                                                            minHeight: '140px', resize: 'none', boxSizing: 'border-box',
                                                            fontFamily: "'Be Vietnam Pro', sans-serif"
                                                        }}
                                                    />
                                                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                                                        <button
                                                            onClick={() => handleNotifyDriver(c.complaint_id)}
                                                            style={{ flex: 1, background: '#6C63FF', color: 'white', borderRadius: '999px', padding: '12px 20px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', border: 'none', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                                        >
                                                            Notify Driver
                                                        </button>
                                                        <button
                                                            onClick={() => setExpandedComplaintId(null)}
                                                            style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.6)', borderRadius: '999px', padding: '12px 16px', fontSize: '12px', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                                        >
                                                            Close
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bottom Row — Category + Status */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                                                <span style={{ background: 'rgba(255,255,255,0.6)', borderRadius: '999px', padding: '4px 14px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'rgba(0,0,0,0.5)' }}>
                                                    {categoryLabel(c.category)}
                                                </span>
                                                <select
                                                    value={c.status}
                                                    onChange={e => handleStatusUpdate(c.complaint_id, e.target.value)}
                                                    style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '999px', padding: '6px 16px', fontSize: '12px', fontWeight: 700, color: statusColor(c.status), outline: 'none', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                                >
                                                    {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    );
                                }

                                /* Standard card */
                                return (
                                    <div
                                        key={c.complaint_id}
                                        className="complaint-card"
                                        style={{ padding: '28px', ...(c.status === 'escalated' ? { borderLeft: '3px solid #E05A5A' } : {}) }}
                                    >
                                        {/* Header Row */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <span className="micro-label" style={{ color: 'rgba(0,0,0,0.4)', fontWeight: 600 }}>
                                                    #{c.complaint_id.slice(0, 8)}
                                                </span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: statusColor(c.status), display: 'inline-block', flexShrink: 0 }} />
                                                    <span style={{ fontSize: '11px', fontWeight: 700, color: statusColor(c.status), textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                                        {statusLabel(c.status)}
                                                    </span>
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '11px', color: 'rgba(0,0,0,0.4)' }}>{formatDate(c.created_at)}</span>
                                        </div>

                                        {/* Organisation */}
                                        <h2 style={{ fontSize: '20px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-0.02em', color: '#0D0D0D', margin: '8px 0 12px 0' }}>
                                            {c.organisation || 'Independent Client'}
                                        </h2>

                                        {/* Description */}
                                        <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.6)', lineHeight: 1.5, marginBottom: '16px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                                            {c.description}
                                        </p>

                                        {/* Category + Status */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                            <span style={{ background: 'rgba(255,255,255,0.6)', borderRadius: '999px', padding: '4px 14px', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'rgba(0,0,0,0.5)' }}>
                                                {categoryLabel(c.category)}
                                            </span>
                                            <select
                                                value={c.status}
                                                onChange={e => handleStatusUpdate(c.complaint_id, e.target.value)}
                                                style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '999px', padding: '6px 16px', fontSize: '12px', fontWeight: 700, color: statusColor(c.status), outline: 'none', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                            >
                                                {STATUSES.map(s => <option key={s} value={s}>{statusLabel(s)}</option>)}
                                            </select>
                                        </div>

                                        {/* Footer */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
                                            <div>
                                                {c.status === 'under_investigation' && (
                                                    <button
                                                        onClick={() => { setExpandedComplaintId(c.complaint_id); toggleMessages(c.complaint_id, c.status); }}
                                                        style={{ background: 'rgba(108,99,255,0.1)', color: '#6C63FF', borderRadius: '999px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                                    >
                                                        View Investigation
                                                    </button>
                                                )}
                                            </div>
                                            <div>
                                                {c.status === 'escalated' && (
                                                    <button
                                                        style={{ background: '#E05A5A', color: 'white', borderRadius: '999px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                                    >
                                                        Review Now
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
