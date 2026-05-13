import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import ChatWindow from '../components/ChatWindow';
import SwiftlinkLogo from '../components/SwiftlinkLogo';
import useOnlineStatus from '../hooks/useOnlineStatus';
import ClientHelpModal from '../components/ClientHelpModal';
import ComplaintCard from '../components/ComplaintCard';

const modalLabelStyle = { fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'rgba(255,255,255,0.5)', marginBottom: '6px', display: 'block' };
const modalInputStyle = { width: '100%', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', color: 'white', outline: 'none', marginBottom: '16px', boxSizing: 'border-box' };

// ── Sub-components ─────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
    const configs = {
        pending:     { label: 'Pending',    bg: 'bg-warning',    text: 'text-white' },
        accepted:    { label: 'Accepted',   bg: 'bg-primary',    text: 'text-white' },
        in_progress: { label: 'In Transit', bg: 'bg-success',    text: 'text-bg-dark' },
        completed:   { label: 'Completed',  bg: 'bg-bg-dark/10', text: 'text-text-muted' },
        cancelled:   { label: 'Cancelled',  bg: 'bg-red-100',    text: 'text-red-600' },
    };
    const cfg = configs[status] || configs.pending;
    return (
        <span className={`${cfg.bg} ${cfg.text} px-3 py-1 rounded-pill text-[9px] font-black tracking-[0.15em] uppercase`}>
            {cfg.label}
        </span>
    );
};

const LoadingState = () => (
    <div className="fixed inset-0 bg-[#F5EDE3] flex flex-col items-center justify-center z-[100]">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-text-muted text-sm font-bold">Loading...</p>
    </div>
);

// Booking form — shown when no active session exists
const BookingFormView = () => {
    const [form, setForm] = useState({
        client_corporate_email: '',
        client_first_name: '',
        pickup_location: '',
        destination: '',
        pickup_time: '',
        flight_number: '',
        notes: '',
        additional_info: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [formError, setFormError] = useState('');
    const [concurrent409, setConcurrent409] = useState(false);
    const [recoverySent, setRecoverySent] = useState(false);
    const [recoveryLoading, setRecoveryLoading] = useState(false);
    const [recoveryError, setRecoveryError] = useState('');

    const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        setFormError('');
        setConcurrent409(false);
        try {
            const payload = {
                client_corporate_email: form.client_corporate_email.trim(),
                client_first_name: form.client_first_name.trim(),
                pickup_location: form.pickup_location.trim(),
                destination: form.destination.trim(),
                pickup_time: form.pickup_time,
            };
            if (form.flight_number.trim()) payload.flight_number = form.flight_number.trim();
            if (form.notes.trim()) payload.notes = form.notes.trim();
            if (form.additional_info.trim()) payload.additional_info = form.additional_info.trim();
            await api.post('/bookings', payload);
            setSubmitted(true);
        } catch (err) {
            if (err.response?.status === 409) {
                setConcurrent409(true);
            } else {
                setFormError(err.response?.data?.error || 'Failed to submit. Please try again.');
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleRecover = async () => {
        const email = form.client_corporate_email.trim();
        if (!email) { setRecoveryError('Enter your email above first.'); return; }
        setRecoveryLoading(true);
        setRecoveryError('');
        try {
            await api.post('/bookings/recover', { client_corporate_email: email });
            setRecoverySent(true);
        } catch (err) {
            setRecoveryError(err.response?.data?.error || 'Failed to send link. Try again.');
        } finally {
            setRecoveryLoading(false);
        }
    };

    const inputStyle = {
        width: '100%', background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(13,13,13,0.12)',
        borderRadius: '12px', padding: '11px 14px', fontSize: '14px', color: 'var(--text-dark)',
        outline: 'none', marginBottom: '14px', boxSizing: 'border-box', fontFamily: 'inherit',
    };
    const labelStyle = {
        fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
        color: 'rgba(13,13,13,0.5)', marginBottom: '5px', display: 'block',
    };
    const optLabel = <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> (optional)</span>;

    if (submitted) {
        return (
            <div className="min-h-screen bg-[#F5EDE3] flex items-center justify-center p-6">
                <div className="glass-card p-10 text-center max-w-sm w-full reveal-up active">
                    <div className="mb-6"><SwiftlinkLogo height={36} /></div>
                    <div className="size-14 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-5">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    </div>
                    <h2 className="text-2xl font-extrabold tracking-tight mb-2">Booking Confirmed</h2>
                    <p className="text-text-muted text-sm leading-relaxed mb-2">
                        Check your corporate inbox for a secure access link to track and manage your trip.
                    </p>
                    <p className="text-[11px] text-text-muted/70 font-medium">The link expires after use — keep it safe.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F5EDE3] relative overflow-hidden">
            <div className="fixed inset-0 arch-grid opacity-40 pointer-events-none z-0" style={{ backgroundSize: '60px 60px', backgroundImage: 'linear-gradient(to right, rgba(13,13,13,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(13,13,13,0.05) 1px, transparent 1px)' }} />
            <div className="relative z-10 flex flex-col items-center px-4 py-10 min-h-screen">
                <div className="mb-8"><SwiftlinkLogo height={40} /></div>
                <div className="glass-card p-8 max-w-md w-full reveal-up active">
                    <h2 className="text-2xl font-extrabold tracking-tight mb-1">Book a Transfer</h2>
                    <p className="text-text-muted text-sm mb-7">Your personal details are never shared with the driver.</p>

                    {concurrent409 && (
                        <div className="mb-5 p-4 rounded-2xl bg-warning/10 border border-warning/25">
                            <p className="text-sm font-bold text-warning mb-1">You have an active booking</p>
                            <p className="text-xs text-text-muted mb-3">We'll send a new access link to your inbox.</p>
                            {recoverySent ? (
                                <p className="text-xs font-bold text-success">✓ Check your inbox.</p>
                            ) : (
                                <button onClick={handleRecover} disabled={recoveryLoading}
                                    style={{ background: '#F59E0B', color: 'white', borderRadius: '9999px', padding: '8px 18px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: recoveryLoading ? 0.7 : 1 }}>
                                    {recoveryLoading ? 'Sending…' : 'Send me access →'}
                                </button>
                            )}
                            {recoveryError && <p className="text-xs mt-2 font-semibold" style={{ color: '#EF4444' }}>{recoveryError}</p>}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <label style={labelStyle}>Corporate Email</label>
                        <input type="email" required value={form.client_corporate_email} onChange={set('client_corporate_email')} placeholder="you@company.com" style={inputStyle} />

                        <label style={labelStyle}>First Name</label>
                        <input required value={form.client_first_name} onChange={set('client_first_name')} placeholder="As on your company profile" style={inputStyle} />

                        <label style={labelStyle}>Pickup Location</label>
                        <input required value={form.pickup_location} onChange={set('pickup_location')} placeholder="e.g. JKIA Terminal 1A" style={inputStyle} />

                        <label style={labelStyle}>Destination</label>
                        <input required value={form.destination} onChange={set('destination')} placeholder="e.g. Westlands, Nairobi" style={inputStyle} />

                        <label style={labelStyle}>Pickup Time</label>
                        <input type="datetime-local" required value={form.pickup_time} onChange={set('pickup_time')} style={inputStyle} />

                        <label style={labelStyle}>Flight Number{optLabel}</label>
                        <input value={form.flight_number} onChange={set('flight_number')} placeholder="e.g. KQ 101" style={inputStyle} />

                        <label style={labelStyle}>Special Instructions{optLabel}</label>
                        <textarea value={form.notes} onChange={set('notes')} placeholder="e.g. wheelchair accessible, extra luggage…" rows={2} style={{ ...inputStyle, resize: 'vertical' }} />

                        <label style={labelStyle}>Additional Notes for Your Driver{optLabel}</label>
                        <textarea value={form.additional_info} onChange={set('additional_info')} placeholder="e.g. wearing a red jacket, I'll be at door 3…" rows={2} style={{ ...inputStyle, resize: 'vertical', marginBottom: '24px' }} />

                        {formError && <p className="text-xs font-semibold mb-4" style={{ color: '#EF4444' }}>{formError}</p>}

                        <button type="submit" disabled={submitting} className="btn-premium btn-dark w-full" style={{ opacity: submitting ? 0.7 : 1 }}>
                            {submitting ? 'Booking…' : 'Request Transfer →'}
                        </button>
                    </form>

                    <div className="mt-6 pt-5 border-t border-black/5 text-center">
                        <p className="text-xs text-text-muted mb-1">Already have a booking?</p>
                        {recoverySent && !concurrent409 ? (
                            <p className="text-xs font-bold text-success">✓ Check your inbox.</p>
                        ) : (
                            <button onClick={handleRecover} disabled={recoveryLoading || !form.client_corporate_email.trim()}
                                className="text-xs font-bold"
                                style={{ color: '#6C63FF', background: 'none', border: 'none', cursor: 'pointer', opacity: !form.client_corporate_email.trim() ? 0.4 : 1 }}>
                                {recoveryLoading ? 'Sending…' : 'Send me a new access link'}
                            </button>
                        )}
                        {recoveryError && !concurrent409 && <p className="text-[10px] mt-1 font-semibold" style={{ color: '#EF4444' }}>{recoveryError}</p>}
                        <p className="text-[10px] text-text-muted/60 mt-1">Enter your email above first</p>
                    </div>
                </div>
            </div>
            <ClientHelpModal context="booking-form" />
        </div>
    );
};

// History view — shown when client has past trips but no active booking
const HistoryView = ({ onBookNew }) => {
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showRemoveModal, setShowRemoveModal] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [removed, setRemoved] = useState(false);

    useEffect(() => {
        api.get('/bookings/history')
            .then(res => setTrips(res.data))
            .catch(() => { /* silent — loading state shows error via empty list */ })
            .finally(() => setLoading(false));
    }, []);

    const handleRemove = async () => {
        setRemoving(true);
        try { await api.post('/bookings/logout'); } catch { /* session may already be cleared */ }
        setRemoved(true);
        setRemoving(false);
    };

    const statusColors = { pending: '#F59E0B', accepted: '#6C63FF', in_progress: '#00C896', completed: '#9CA3AF', cancelled: '#EF4444' };
    const statusLabels = { pending: 'Pending', accepted: 'Accepted', in_progress: 'In Transit', completed: 'Completed', cancelled: 'Cancelled' };

    return (
        <div className="min-h-screen bg-[#F5EDE3] relative overflow-hidden">
            <div className="fixed inset-0 arch-grid opacity-40 pointer-events-none z-0" style={{ backgroundSize: '60px 60px', backgroundImage: 'linear-gradient(to right, rgba(13,13,13,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(13,13,13,0.05) 1px, transparent 1px)' }} />
            <nav className="sticky top-0 z-50 h-[56px] px-5 bg-[#F5EDE3]/80 backdrop-blur-[20px] flex items-center justify-between border-b border-black/5">
                <SwiftlinkLogo height={36} />
                <span className="text-[9px] font-black tracking-[0.15em] uppercase text-text-muted">Trip History</span>
            </nav>
            <main className="px-4 pt-6 pb-24 max-w-lg mx-auto relative z-10">
                <div className="mb-6">
                    <h2 className="text-2xl font-extrabold tracking-tight mb-1">Your Trips</h2>
                    <p className="text-text-muted text-sm">All bookings under your corporate email.</p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : trips.length === 0 ? (
                    <div className="glass-card p-8 text-center reveal-up active mb-5">
                        <p className="text-text-muted text-sm">No past trips found.</p>
                    </div>
                ) : (
                    <div className="space-y-3 mb-6">
                        {trips.map((trip, i) => (
                            <div key={trip.id} className={`glass-card p-4 reveal-up active stagger-${Math.min(i + 1, 5)}`}>
                                <div className="flex justify-between items-start mb-2">
                                    <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">#{trip.id.slice(0, 8).toUpperCase()}</span>
                                    <span style={{ fontSize: '9px', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: '9999px', background: `${statusColors[trip.status] || '#9CA3AF'}18`, color: statusColors[trip.status] || '#9CA3AF' }}>
                                        {statusLabels[trip.status] || trip.status}
                                    </span>
                                </div>
                                <p className="font-bold text-sm leading-tight mb-1">
                                    {trip.pickup_location} <span className="text-primary">→</span> {trip.destination}
                                </p>
                                <p className="text-[11px] text-text-muted">
                                    {new Date(trip.pickup_time).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                <button onClick={onBookNew} className="btn-premium btn-dark w-full mb-3">Book a New Ride →</button>
                <button onClick={() => setShowRemoveModal(true)} className="w-full py-3 text-sm font-bold text-text-muted" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    Remove this app
                </button>
            </main>

            {showRemoveModal && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px' }}>
                    <div className="glass-card p-6 max-w-sm w-full" style={{ borderRadius: '24px 24px 16px 16px' }}>
                        {removed ? (
                            <>
                                <h3 className="text-lg font-extrabold mb-3">Session cleared</h3>
                                <p className="text-sm text-text-muted mb-4 leading-relaxed">To remove the app from your device:</p>
                                <ul className="text-sm text-text-muted space-y-2 mb-5" style={{ listStyle: 'none', padding: 0 }}>
                                    <li><strong>Android Chrome:</strong> Menu ⋮ → Apps → Manage apps → SwiftLink → Remove</li>
                                    <li><strong>iOS Safari:</strong> Long-press the SwiftLink icon → Remove App</li>
                                </ul>
                                <button onClick={() => setShowRemoveModal(false)} className="btn-premium btn-dark w-full">Done</button>
                            </>
                        ) : (
                            <>
                                <h3 className="text-lg font-extrabold mb-2">Remove this app?</h3>
                                <p className="text-sm text-text-muted mb-6 leading-relaxed">This will clear your session. You'll get instructions to remove SwiftLink from your device.</p>
                                <div className="flex gap-3">
                                    <button onClick={() => setShowRemoveModal(false)} className="flex-1 py-3 rounded-full text-sm font-bold" style={{ background: 'rgba(13,13,13,0.07)', border: 'none', cursor: 'pointer' }}>Keep it</button>
                                    <button onClick={handleRemove} disabled={removing} className="flex-1 py-3 rounded-full text-sm font-bold text-white" style={{ background: '#EF4444', border: 'none', cursor: 'pointer', opacity: removing ? 0.7 : 1 }}>
                                        {removing ? 'Clearing…' : 'Remove'}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
            <ClientHelpModal context="history" />
        </div>
    );
};

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function BookingLandingPage() {
    const [view, setView] = useState('loading'); // 'loading' | 'booking-form' | 'history' | 'trip'
    const [searchParams] = useSearchParams();
    const [tripId, setTripId] = useState(null);
    const [booking, setBooking] = useState(null);
    const [networkError, setNetworkError] = useState(false);

    // Complaint
    const [complaintStatus, setComplaintStatus] = useState({ loading: false, success: false, error: false });
    const [complaintWindowSeconds, setComplaintWindowSeconds] = useState(null);
    const [complaintProgress, setComplaintProgress] = useState(null);

    // Edit
    const [showEditForm, setShowEditForm] = useState(false);
    const [editAdditionalInfoOnly, setEditAdditionalInfoOnly] = useState(false);
    const [editForm, setEditForm] = useState({ pickup_location: '', destination: '', pickup_time: '', flight_number: '', notes: '', additional_info: '' });
    const [editLoading, setEditLoading] = useState(false);
    const [editError, setEditError] = useState('');

    // Cancel
    const [cancelConfirming, setCancelConfirming] = useState(false);
    const [cancelling, setCancelling] = useState(false);

    // Push notification state — permission prompt shown in trip view
    const [notifPermission, setNotifPermission] = useState(() =>
        typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
    );
    const [notifLoading, setNotifLoading] = useState(false);

    const isOnline = useOnlineStatus();
    const [queuedComplaint, setQueuedComplaint] = useState(null);

    const authStarted = useRef(false);

    // ── Session init ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (authStarted.current) return;
        authStarted.current = true;

        const initSession = async () => {
            const token = searchParams.get('token');
            try {
                let res;
                if (token) {
                    res = await api.get(`/bookings/auth?token=${token}`);
                    window.history.replaceState({}, '', '/booking');
                } else {
                    res = await api.get('/bookings/session');
                }
                if (res.data.session_type === 'history') {
                    setView('history');
                } else {
                    setTripId(res.data.trip_id);
                    setView('trip');
                }
            } catch {
                setView('booking-form');
            }
        };
        initSession();
    }, [searchParams]);

    // ── Booking fetch + poll ───────────────────────────────────────────────────
    const fetchBooking = useCallback(async () => {
        if (!tripId) return;
        try {
            const res = await api.get(`/bookings/${tripId}`);
            setBooking(res.data);
            if (res.data.complaint_window_seconds !== undefined) {
                setComplaintWindowSeconds(res.data.complaint_window_seconds);
            }
            setNetworkError(false);
        } catch {
            setNetworkError(true);
        }
    }, [tripId]);

    const pollInterval = (!booking?.status || booking.status === 'pending' || booking.status === 'accepted') ? 3000 : 10000;

    useEffect(() => {
        if (!tripId) return;
        fetchBooking();
        const interval = setInterval(fetchBooking, pollInterval);
        return () => clearInterval(interval);
    }, [tripId, fetchBooking, pollInterval]);

    useEffect(() => {
        const handleVisibility = () => { if (document.visibilityState === 'visible') fetchBooking(); };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, [fetchBooking]);

    // ── Complaint window countdown ─────────────────────────────────────────────
    useEffect(() => {
        if (complaintWindowSeconds === null || complaintWindowSeconds <= 0) return;
        const timer = setInterval(() => setComplaintWindowSeconds(prev => (prev > 0 ? prev - 1 : 0)), 1000);
        return () => clearInterval(timer);
    }, [complaintWindowSeconds]);

    useEffect(() => {
        if (!complaintStatus.success || !tripId) return;
        const poll = async () => {
            try { const res = await api.get(`/complaints/${tripId}/status`); setComplaintProgress(res.data); } catch { /* silent — next poll will retry */ }
        };
        poll();
        const interval = setInterval(poll, 30000);
        return () => clearInterval(interval);
    }, [complaintStatus.success, tripId]);

    // Restore queued complaint from localStorage when tripId is known
    useEffect(() => {
        if (!tripId) return;
        const stored = localStorage.getItem(`swiftlink_queued_complaint_${tripId}`);
        if (stored) {
            try { setQueuedComplaint(JSON.parse(stored)); } catch { /* malformed localStorage entry — ignore */ }
        }
    }, [tripId]);

    // Drain queued complaint when connectivity is restored
    useEffect(() => {
        if (!isOnline || !tripId || !queuedComplaint) return;
        api.post(`/complaints/${tripId}`, queuedComplaint)
            .then(() => {
                localStorage.removeItem(`swiftlink_queued_complaint_${tripId}`);
                setQueuedComplaint(null);
                setComplaintStatus({ loading: false, success: true, error: false });
            })
            .catch(() => { /* silent — will retry on next online event */ });
    }, [isOnline, tripId, queuedComplaint]);

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleComplaintSubmit = async ({ category, description }) => {
        const complaintData = { category, description };
        if (!isOnline) {
            localStorage.setItem(`swiftlink_queued_complaint_${tripId}`, JSON.stringify(complaintData));
            setQueuedComplaint(complaintData);
            return;
        }
        setComplaintStatus({ loading: true, success: false, error: false });
        try {
            await api.post(`/complaints/${tripId}`, complaintData);
            setComplaintStatus({ loading: false, success: true, error: false });
        } catch {
            setComplaintStatus({ loading: false, success: false, error: true });
        }
    };

    const handleEditSubmit = async () => {
        setEditLoading(true);
        setEditError('');
        try {
            const payload = {};
            if (!editAdditionalInfoOnly) {
                if (editForm.pickup_location.trim()) payload.pickup_location = editForm.pickup_location.trim();
                if (editForm.destination.trim()) payload.destination = editForm.destination.trim();
                if (editForm.pickup_time) payload.pickup_time = editForm.pickup_time;
                if (editForm.flight_number.trim()) payload.flight_number = editForm.flight_number.trim();
                payload.notes = editForm.notes.trim() || null;
            }
            payload.additional_info = editForm.additional_info.trim() || null;
            await api.patch(`/bookings/${tripId}`, payload);
            setShowEditForm(false);
            setEditAdditionalInfoOnly(false);
            setEditForm({ pickup_location: '', destination: '', pickup_time: '', flight_number: '', notes: '', additional_info: '' });
            fetchBooking();
        } catch (err) {
            setEditError(err.response?.data?.error || 'Failed to update booking');
        } finally {
            setEditLoading(false);
        }
    };

    const handleCancel = async () => {
        setCancelling(true);
        try {
            await api.delete(`/bookings/${tripId}`);
            setCancelConfirming(false);
            fetchBooking();
        } catch {
            setCancelConfirming(false);
        } finally {
            setCancelling(false);
        }
    };

    const openFullEdit = () => {
        setEditAdditionalInfoOnly(false);
        setEditForm({
            pickup_location: booking.pickup_location,
            destination: booking.destination,
            pickup_time: booking.pickup_time ? new Date(booking.pickup_time).toISOString().slice(0, 16) : '',
            flight_number: booking.flight_number || '',
            notes: booking.notes || '',
            additional_info: booking.additional_info || '',
        });
        setShowEditForm(true);
    };

    const openAdditionalInfoEdit = () => {
        setEditAdditionalInfoOnly(true);
        setEditForm(f => ({ ...f, additional_info: booking.additional_info || '' }));
        setShowEditForm(true);
    };

    const handleEnablePush = async () => {
        if (typeof Notification === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
        setNotifLoading(true);
        try {
            const permission = await Notification.requestPermission();
            setNotifPermission(permission);
            if (permission !== 'granted') return;

            const vapidRes = await fetch(`${import.meta.env.VITE_API_URL}/push/vapid-public-key`);
            if (!vapidRes.ok) return;
            const { publicKey } = await vapidRes.json();

            const padding = '='.repeat((4 - (publicKey.length % 4)) % 4);
            const base64 = (publicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
            const rawData = atob(base64);
            const applicationServerKey = Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));

            const reg = await navigator.serviceWorker.ready;
            const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
            await api.post('/bookings/push-subscribe', subscription);
        } catch {
            // Best-effort — push failure is silent
        } finally {
            setNotifLoading(false);
        }
    };

    // ── View routing ──────────────────────────────────────────────────────────
    if (view === 'loading') return <LoadingState />;
    if (view === 'booking-form') return <BookingFormView />;
    if (view === 'history') return <HistoryView onBookNew={() => setView('booking-form')} />;
    if (!booking) return <LoadingState />;

    const status = booking.status;
    const isPending    = status === 'pending';
    const isAccepted   = status === 'accepted';
    const isInProgress = status === 'in_progress';
    const isCompleted  = status === 'completed';
    const isCancelled  = status === 'cancelled';
    const isActive     = isAccepted || isInProgress;
    const canCancel    = isPending || isAccepted;

    const getProgressWidth = () => {
        if (isCancelled) return '0%';
        if (isPending)    return '10%';
        if (isAccepted)   return '40%';
        if (isInProgress) return '75%';
        if (isCompleted)  return '100%';
        return '0%';
    };

    const vehicleDisplay = (() => {
        const { vehicle_make, vehicle_model, vehicle_plate } = booking;
        const makeModel = [vehicle_make, vehicle_model].filter(Boolean).join(' ');
        if (makeModel && vehicle_plate) return `${makeModel} · ${vehicle_plate}`;
        if (vehicle_plate) return vehicle_plate;
        if (makeModel) return makeModel;
        return booking.vehicle_type || 'Vehicle assigned';
    })();

    const formatEta = (eta) => new Date(eta).toLocaleTimeString('en-KE', {
        timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit',
    });

    const helpContext = isInProgress ? 'trip-active'
        : isAccepted   ? 'trip-accepted'
        : isPending    ? 'trip-pending'
        : 'trip-ended';

    return (
        <div className="min-h-screen bg-[#F5EDE3] relative overflow-hidden flex flex-col">
            <div className="fixed inset-0 arch-grid opacity-40 pointer-events-none z-0" style={{ backgroundSize: '60px 60px', backgroundImage: 'linear-gradient(to right, rgba(13,13,13,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(13,13,13,0.05) 1px, transparent 1px)' }} />
            <div className="fixed top-[10%] right-[-5%] z-[-2] animate-float-slow text-primary/10" style={{ pointerEvents: 'none' }}>
                <div className="w-[100px] h-[100px] bg-currentColor" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', pointerEvents: 'none' }} />
            </div>
            <div className="fixed bottom-[5%] left-[-8%] z-[-2] animate-float-reverse text-bg-dark/5" style={{ pointerEvents: 'none' }}>
                <div className="w-[100px] h-[100px] bg-currentColor" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)', pointerEvents: 'none' }} />
            </div>

            {/* Sticky nav */}
            <nav className="sticky top-0 z-50 h-[56px] px-5 bg-[#F5EDE3]/80 backdrop-blur-[20px] flex items-center justify-between border-b border-black/5">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <SwiftlinkLogo height={36} />
                    {!isOnline && (
                        <span style={{ fontSize: '10px', fontWeight: 700, background: 'rgba(239,68,68,0.08)', color: '#EF4444', padding: '2px 8px', borderRadius: '9999px', letterSpacing: '0.05em', border: '1px solid rgba(239,68,68,0.15)' }}>
                            offline
                        </span>
                    )}
                </div>
                <StatusBadge status={status} />
            </nav>

            <main className={`flex-1 overflow-y-auto px-4 pt-6 pb-20 max-w-lg mx-auto w-full ${isActive ? 'pb-[84px]' : ''}`}>
                {networkError && (
                    <div className="bg-warning/10 border border-warning/20 rounded-2xl p-3 text-sm text-warning mb-4 text-center">
                        Could not reach server — retrying...
                    </div>
                )}

                {/* Push permission prompt — shown once, at booking confirmation moment */}
                {notifPermission === 'default' && (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-4" style={{ background: 'rgba(108,99,255,0.07)', border: '1px solid rgba(108,99,255,0.18)' }}>
                        <span style={{ fontSize: '20px', flexShrink: 0 }}>🔔</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold leading-tight">Get notified when your driver accepts</p>
                            <p className="text-[11px] text-text-muted mt-0.5">One tap — no account needed.</p>
                        </div>
                        <button
                            onClick={handleEnablePush}
                            disabled={notifLoading}
                            style={{ background: '#6C63FF', color: 'white', borderRadius: '999px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: notifLoading ? 'not-allowed' : 'pointer', flexShrink: 0, opacity: notifLoading ? 0.7 : 1 }}
                        >
                            {notifLoading ? '…' : 'Enable'}
                        </button>
                    </div>
                )}

                {/* Cancelled banner */}
                {isCancelled && (
                    <div className="glass-card p-5 reveal-up active mb-5 flex items-center gap-4">
                        <div className="text-2xl shrink-0">🚫</div>
                        <div className="flex-1">
                            <p className="font-extrabold text-sm mb-0.5">Booking Cancelled</p>
                            <p className="text-text-muted text-xs">This trip was cancelled.</p>
                        </div>
                        <button onClick={() => setView('booking-form')} style={{ background: 'rgba(108,99,255,0.1)', color: '#6C63FF', borderRadius: '999px', padding: '6px 14px', fontSize: '11px', fontWeight: 700, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            Book new →
                        </button>
                    </div>
                )}

                {/* Trip Details Card */}
                <div className="glass-card p-6 reveal-up active stagger-1 mb-5">
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">TRIP #{booking.id.slice(0, 8).toUpperCase()}</span>
                        <span className="font-mono font-bold text-sm">{new Date(booking.pickup_time).toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit' })} <span className="font-normal text-text-muted text-[10px]">EAT</span></span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl kinetic-text mb-4">
                        {booking.pickup_location} <span className="text-primary">→</span> {booking.destination}
                    </h2>

                    {/* ETA — shown at accepted only */}
                    {isAccepted && booking.eta && (
                        <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-2xl w-fit" style={{ background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.15)' }}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6C63FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            <span className="text-[11px] font-bold" style={{ color: '#6C63FF' }}>ETA {formatEta(booking.eta)}</span>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2 mb-4">
                        <span className="bg-bg-dark/5 px-3 py-1.5 rounded-pill text-[10px] font-bold">
                            {new Date(booking.pickup_time).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short' })}
                        </span>
                        {booking.flight_number ? (
                            <span className="bg-bg-dark/5 px-3 py-1.5 rounded-pill font-mono text-[10px] font-bold">✈ {booking.flight_number}</span>
                        ) : (
                            <span className="bg-bg-dark/5 px-3 py-1.5 rounded-pill text-[10px] font-bold uppercase tracking-wider">Private Transfer</span>
                        )}
                    </div>

                    {booking.notes && (
                        <div className="mb-4 p-3 rounded-2xl" style={{ background: 'rgba(108,99,255,0.06)', border: '1px solid rgba(108,99,255,0.15)' }}>
                            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: '#6C63FF' }}>Special Instructions</p>
                            <p className="text-sm" style={{ color: 'var(--text-dark)', lineHeight: 1.6 }}>{booking.notes}</p>
                        </div>
                    )}

                    {/* Additional info */}
                    {booking.additional_info && (
                        <div className="mb-4 p-3 rounded-2xl bg-bg-dark/5">
                            <div className="flex justify-between items-start gap-2">
                                <div className="flex-1">
                                    <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-text-muted">Notes for Driver</p>
                                    <p className="text-sm" style={{ lineHeight: 1.6 }}>{booking.additional_info}</p>
                                    {!isPending && !isAccepted && (
                                        <p className="text-[10px] text-text-muted/70 mt-1 italic">Your driver has been briefed</p>
                                    )}
                                </div>
                                {isAccepted && (
                                    <button onClick={openAdditionalInfoEdit} style={{ background: 'rgba(108,99,255,0.1)', color: '#6C63FF', borderRadius: '999px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                                        Edit
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <div className="h-1.5 bg-bg-dark/5 rounded-full overflow-hidden mb-4">
                        <div className={`h-full transition-all duration-1000 ${isCompleted ? 'bg-success' : isCancelled ? 'bg-bg-dark/10' : 'bg-primary'}`} style={{ width: getProgressWidth() }} />
                    </div>

                    {/* Action row */}
                    {!isCancelled && (
                        <div className="flex items-center gap-3 flex-wrap">
                            {isPending && (
                                <button onClick={openFullEdit} style={{ background: 'rgba(108,99,255,0.1)', color: '#6C63FF', borderRadius: '999px', padding: '6px 16px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                                    Edit Booking
                                </button>
                            )}
                            {isAccepted && !booking.additional_info && (
                                <button onClick={openAdditionalInfoEdit} style={{ background: 'rgba(108,99,255,0.1)', color: '#6C63FF', borderRadius: '999px', padding: '6px 16px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                                    Add driver notes
                                </button>
                            )}

                            {canCancel && (
                                <div className="ml-auto">
                                    {cancelConfirming ? (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold text-text-muted">Cancel trip?</span>
                                            <button onClick={handleCancel} disabled={cancelling}
                                                style={{ background: '#EF4444', color: 'white', borderRadius: '999px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: cancelling ? 0.7 : 1 }}>
                                                {cancelling ? '…' : 'Yes'}
                                            </button>
                                            <button onClick={() => setCancelConfirming(false)}
                                                style={{ background: 'rgba(13,13,13,0.07)', borderRadius: '999px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                                                No
                                            </button>
                                        </div>
                                    ) : (
                                        <button onClick={() => setCancelConfirming(true)}
                                            style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444', borderRadius: '999px', padding: '6px 16px', fontSize: '12px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                                            Cancel Booking
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Driver Card */}
                {!isPending && !isCancelled && booking.driver_name && (
                    <div className="glass-card p-6 reveal-up active stagger-2 mb-5">
                        <div className="flex items-center gap-4 mb-5">
                            <div className="bg-bg-dark text-text-cream size-14 rounded-full flex items-center justify-center font-extrabold text-2xl">
                                {booking.driver_name[0]}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-extrabold text-xl tracking-tight leading-tight">{booking.driver_name.split(' ')[0]}</h3>
                                <p className="text-[10px] uppercase tracking-widest text-text-muted font-black">{vehicleDisplay}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`size-2 rounded-full ${isAccepted ? 'bg-[#F59E0B]' : isInProgress ? 'bg-[#00F5A0] session-pulse' : 'bg-text-muted'}`} />
                                <span className="text-xs font-bold text-text-muted">
                                    {isAccepted ? 'En route' : isInProgress ? 'In transit' : 'Trip complete'}
                                </span>
                            </div>
                        </div>
                        <div className="bg-white/40 rounded-2xl p-3 flex items-start gap-3">
                            <span className="text-lg">🔒</span>
                            <p className="text-[11px] leading-relaxed text-text-muted italic">Contact details structurally excluded from this session · Mediated channel</p>
                        </div>
                    </div>
                )}

                {/* Chat */}
                {!isCancelled && (
                    <div className="reveal-up active stagger-3 flex flex-col min-h-[450px] mb-5">
                        {isInProgress ? (
                            <ChatWindow tripId={tripId} token={undefined} role="client" counterpartName={booking.driver_name?.split(' ')[0] || 'Driver'} />
                        ) : (
                            <div className="glass-card-dark flex-1 flex flex-col items-center justify-center p-8 text-center rounded-[24px]">
                                <div className="text-5xl mb-6">🔒</div>
                                <h3 className="text-xl font-bold text-text-cream mb-2">Secure channel pending</h3>
                                <p className="text-text-muted text-sm leading-relaxed">
                                    {isCompleted ? 'This trip has ended. The channel is closed.'
                                     : isAccepted ? 'Your driver is en route. The channel opens automatically when the trip starts.'
                                     : 'Your driver will be assigned shortly. The channel opens when they start the trip.'}
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* Complaint section */}
                {isCompleted && (
                    <div className="reveal-up active mb-10">
                        {complaintStatus.success ? (
                            <div className="glass-card reveal-up active" style={{ padding: '24px', borderRadius: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0, background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: '#6C63FF' }}>✓</div>
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>Complaint Received</div>
                                        {complaintProgress && (
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                Filed {new Date(complaintProgress.created_at).toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                {complaintProgress ? (() => {
                                    const steps = ['Filed', 'Under Investigation', 'Resolved'];
                                    const stepIndex = { open: 0, under_investigation: 1, resolved: 2, escalated: 2 };
                                    const current = stepIndex[complaintProgress.status] ?? 0;
                                    const activeColor = '#6C63FF';
                                    const futureColor = 'rgba(0,0,0,0.15)';
                                    return (
                                        <>
                                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                                                {steps.map((step, i) => (
                                                    <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
                                                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0, background: i <= current ? activeColor : futureColor, boxShadow: i === current ? '0 0 8px rgba(108,99,255,0.5)' : 'none' }} />
                                                        {i < steps.length - 1 && <div style={{ flex: 1, height: '1px', background: i < current ? activeColor : futureColor }} />}
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                                {steps.map((step, i) => {
                                                    const isStepActive = i === current;
                                                    const isFuture = i > current;
                                                    return (
                                                        <span key={step} style={{ fontSize: '10px', fontWeight: isStepActive ? 800 : 600, letterSpacing: isStepActive ? '-0.05em' : '0.08em', color: isFuture ? 'var(--text-muted)' : 'var(--text-primary)', textTransform: isStepActive ? 'none' : 'uppercase', textAlign: i === 0 ? 'left' : i === 2 ? 'right' : 'center' }}>
                                                            {step}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                            <div style={{ marginBottom: '16px' }}>
                                                <span style={{ display: 'inline-block', fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '4px 12px', borderRadius: '9999px', background: 'rgba(108,99,255,0.1)', border: '1px solid rgba(108,99,255,0.2)', color: '#6C63FF' }}>
                                                    {complaintProgress.category}
                                                </span>
                                            </div>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>Email updates will be sent as your complaint progresses.</p>
                                            {complaintProgress.investigation_notes && (
                                                <div style={{ marginTop: '16px', padding: '16px', background: 'rgba(108,99,255,0.06)', borderRadius: '14px', border: '1px solid rgba(108,99,255,0.12)' }}>
                                                    <p style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(108,99,255,0.7)', marginBottom: '8px' }}>Investigation Notes</p>
                                                    <p style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>{complaintProgress.investigation_notes}</p>
                                                </div>
                                            )}
                                        </>
                                    );
                                })() : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '16px', height: '16px', border: '2px solid #6C63FF', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading progress...</span>
                                    </div>
                                )}
                            </div>
                        ) : queuedComplaint ? (
                            <div className="glass-card" style={{ padding: '32px 28px', borderRadius: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', textAlign: 'center' }}>
                                <div style={{ fontSize: '32px' }}>📋</div>
                                <h3 className="kinetic-text" style={{ fontSize: '18px', margin: 0 }}>Complaint Queued</h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
                                    Your complaint has been saved. It will be submitted automatically when connectivity is restored.
                                </p>
                                <span style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(245,158,11,0.12)', color: '#F59E0B', padding: '4px 14px', borderRadius: '9999px', border: '1px solid rgba(245,158,11,0.2)' }}>
                                    {queuedComplaint.category}
                                </span>
                            </div>
                        ) : (
                            <ComplaintCard
                                complaintWindowSeconds={complaintWindowSeconds ?? 86400}
                                onSubmit={handleComplaintSubmit}
                                loading={complaintStatus.loading}
                                error={complaintStatus.error}
                                offline={!isOnline}
                            />
                        )}
                    </div>
                )}
            </main>

            {/* Edit Modal */}
            {showEditForm && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div className="glass-card-dark" style={{ padding: '32px', maxWidth: '440px', width: '100%', borderRadius: '24px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'white', marginBottom: '24px' }}>
                            {editAdditionalInfoOnly ? 'Notes for Driver' : 'Update Booking'}
                        </h3>

                        {!editAdditionalInfoOnly && (
                            <>
                                <label style={modalLabelStyle}>Pickup Location</label>
                                <input value={editForm.pickup_location} onChange={e => setEditForm(f => ({ ...f, pickup_location: e.target.value }))} style={modalInputStyle} />
                                <label style={modalLabelStyle}>Destination</label>
                                <input value={editForm.destination} onChange={e => setEditForm(f => ({ ...f, destination: e.target.value }))} style={modalInputStyle} />
                                <label style={modalLabelStyle}>Pickup Time</label>
                                <input type="datetime-local" value={editForm.pickup_time} onChange={e => setEditForm(f => ({ ...f, pickup_time: e.target.value }))} style={modalInputStyle} />
                                <label style={modalLabelStyle}>Flight Number</label>
                                <input value={editForm.flight_number} onChange={e => setEditForm(f => ({ ...f, flight_number: e.target.value }))} placeholder="Optional" style={modalInputStyle} />
                                <label style={modalLabelStyle}>Special Instructions</label>
                                <textarea value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} rows={2} style={{ ...modalInputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
                            </>
                        )}

                        <label style={modalLabelStyle}>Additional Notes for Driver</label>
                        <textarea value={editForm.additional_info} onChange={e => setEditForm(f => ({ ...f, additional_info: e.target.value }))}
                            placeholder="e.g. wearing a red jacket, I'll be at door 3…" rows={3}
                            style={{ ...modalInputStyle, resize: 'vertical', fontFamily: 'inherit', marginBottom: '16px' }} />

                        {editError && <p style={{ fontSize: '12px', color: '#EF4444', fontWeight: 600, marginBottom: '16px' }}>{editError}</p>}

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => { setShowEditForm(false); setEditError(''); setEditAdditionalInfoOnly(false); }} className="glass-card"
                                style={{ padding: '10px 20px', borderRadius: '999px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                                Cancel
                            </button>
                            <button onClick={handleEditSubmit} disabled={editLoading}
                                style={{ background: '#6C63FF', color: 'white', borderRadius: '999px', padding: '10px 24px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', opacity: editLoading ? 0.7 : 1 }}>
                                {editLoading ? 'Saving…' : 'Update'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ClientHelpModal context={helpContext} />
        </div>
    );
}
