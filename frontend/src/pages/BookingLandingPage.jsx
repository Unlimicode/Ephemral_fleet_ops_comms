import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import ChatWindow from '../components/ChatWindow';
import SwiftlinkLogo from '../components/SwiftlinkLogo';

// --- Components ---

const StatusBadge = ({ status }) => {
    const configs = {
        pending: { label: 'Pending', bg: 'bg-warning', text: 'text-white' },
        accepted: { label: 'Accepted', bg: 'bg-primary', text: 'text-white' },
        in_progress: { label: 'In Transit', bg: 'bg-success', text: 'text-bg-dark' },
        completed: { label: 'Completed', bg: 'bg-bg-dark/10', text: 'text-text-muted' },
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
        <p className="text-text-muted text-sm font-bold">Loading your trip...</p>
    </div>
);

const AuthError = ({ onRetry, email, setEmail, recoverySent }) => (
    <div className="min-h-screen bg-[#F5EDE3] flex items-center justify-center p-6">
        <div className="glass-card p-10 text-center max-w-sm w-full reveal-up active">
            <div className="text-4xl mb-4">🔒</div>
            <h2 className="text-2xl font-extrabold tracking-tight mb-2">This link has expired.</h2>
            <p className="text-text-muted text-sm mb-8">We'll send you a link for your most recent active trip.</p>

            <div className="space-y-4">
                <input
                    type="email"
                    placeholder="Corporate email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-input bg-white/40 border border-white/60 px-4 py-3 outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                    onClick={onRetry}
                    className="btn-premium btn-dark w-full"
                >
                    Send New Link
                </button>
                {recoverySent && <p className="text-success text-xs font-bold mt-2">✓ Check your inbox.</p>}
            </div>
        </div>
    </div>
);

// --- Page ---

export default function BookingLandingPage() {
    const [searchParams] = useSearchParams();
    const [tripId, setTripId] = useState(null);
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authFailed, setAuthFailed] = useState(false);
    const [recoveryEmail, setRecoveryEmail] = useState('');
    const [recoverySent, setRecoverySent] = useState(false);
    const [networkError, setNetworkError] = useState(false);
    const [complaintStatus, setComplaintStatus] = useState({ loading: false, success: false, error: false });
    const [complaintForm, setComplaintForm] = useState({ category: 'Service Quality', description: '' });
    const [complaintWindowSeconds, setComplaintWindowSeconds] = useState(null);
    const [complaintProgress, setComplaintProgress] = useState(null);
    const [descFocused, setDescFocused] = useState(false);

    const authStarted = useRef(false);
    // Initial Auth & Session Hydration
    useEffect(() => {
        if (authStarted.current) return;
        authStarted.current = true;

        const validateSession = async () => {
            const token = searchParams.get('token');
            try {
                if (token) {
                    const res = await api.get(`/bookings/auth?token=${token}`);
                    setTripId(res.data.trip_id);
                    window.history.replaceState({}, '', '/booking');
                } else {
                    const res = await api.get('/bookings/session');
                    setTripId(res.data.trip_id);
                }
            } catch {
                setAuthFailed(true);
            } finally {
                setLoading(false);
            }
        };
        validateSession();
    }, [searchParams]);

    // Fetch Booking Data
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

    const pollInterval = (!booking?.status || booking.status === 'pending') ? 3000 : 10000;

    useEffect(() => {
        if (tripId) {
            fetchBooking();
            const interval = setInterval(fetchBooking, pollInterval);
            return () => clearInterval(interval);
        }
    }, [tripId, fetchBooking, pollInterval]);

    // Live Countdown for Complaint Window
    useEffect(() => {
        if (complaintWindowSeconds === null || complaintWindowSeconds <= 0) return;
        const timer = setInterval(() => {
            setComplaintWindowSeconds(prev => (prev !== null && prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [complaintWindowSeconds]);

    const handleComplaintSubmit = async (e) => {
        e.preventDefault();
        setComplaintStatus({ loading: true, success: false, error: false });
        try {
            await api.post(`/complaints/${tripId}`, complaintForm);
            setComplaintStatus({ loading: false, success: true, error: false });
        } catch {
            setComplaintStatus({ loading: false, success: false, error: true });
        }
    };

    const handleRequestNewLink = async () => {
        if (!recoveryEmail) return;
        try {
            await api.post('/bookings/request-new-link', { email: recoveryEmail });
            setRecoverySent(true);
        } catch {
            // Instruction: simplest friction-less approach
            setRecoverySent(true);
        }
    };

    // Poll complaint progress after submission
    useEffect(() => {
        if (!complaintStatus.success || !tripId) return;
        const pollProgress = async () => {
            try {
                const res = await api.get(`/complaints/${tripId}/status`);
                setComplaintProgress(res.data);
            } catch {
                // Silently fail — endpoint may 404 if no complaint exists yet
            }
        };
        pollProgress();
        const interval = setInterval(pollProgress, 30000);
        return () => clearInterval(interval);
    }, [complaintStatus.success, tripId]);

    if (loading) return <LoadingState />;
    if (authFailed) return <AuthError email={recoveryEmail} setEmail={setRecoveryEmail} onRetry={handleRequestNewLink} recoverySent={recoverySent} />;
    if (!booking) return null;

    const status = booking.status;
    const isActive = status === 'accepted' || status === 'in_progress';
    const isCompleted = status === 'completed';
    const isPending = status === 'pending';

    const getProgressWidth = () => {
        if (isPending) return '10%';
        if (status === 'accepted') return '40%';
        if (status === 'in_progress') return '75%';
        if (isCompleted) return '100%';
        return '0%';
    };

    return (
        <div className="min-h-screen bg-[#F5EDE3] relative overflow-hidden flex flex-col">
            {/* Background elements */}
            <div className="fixed inset-0 arch-grid opacity-40 pointer-events-none z-0" style={{ backgroundSize: '60px 60px', backgroundImage: 'linear-gradient(to right, rgba(13,13,13,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(13,13,13,0.05) 1px, transparent 1px)' }} />

            <div className="fixed top-[10%] right-[-5%] z-[-2] animate-float-slow text-primary/10">
                <div className="w-[100px] h-[100px] bg-currentColor" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
            </div>
            <div className="fixed bottom-[5%] left-[-8%] z-[-2] animate-float-reverse text-bg-dark/5">
                <div className="w-[100px] h-[100px] bg-currentColor" style={{ clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
            </div>

            {/* Sticky Top Bar */}
            <nav className="sticky top-0 z-50 h-[56px] px-5 bg-[#F5EDE3]/80 backdrop-blur-[20px] flex items-center justify-between border-b border-black/5">
                <div className="flex items-center">
                    <SwiftlinkLogo height={36} />
                </div>
                <StatusBadge status={status} />
            </nav>

            {/* Scrollable Content */}
            <main className={`flex-1 overflow-y-auto px-4 pt-6 pb-20 max-w-lg mx-auto w-full ${isActive ? 'pb-[84px]' : ''}`}>
                {networkError && (
                    <div className="bg-warning/10 border border-warning/20 rounded-2xl p-3 text-sm text-warning mb-4 text-center">
                        Could not reach server — retrying...
                    </div>
                )}

                {/* Trip Details Card */}
                <div className="glass-card p-6 reveal-up active stagger-1 mb-5">
                    <div className="flex justify-between items-center mb-4">
                        <span className="font-mono text-[10px] text-text-muted uppercase tracking-widest">
                            TRIP #{booking.id.slice(0, 8).toUpperCase()}
                        </span>
                        <span className="font-mono font-bold text-sm">
                            {new Date(booking.pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl kinetic-text mb-6">
                        {booking.pickup_location} <span className="text-primary">→</span> {booking.destination}
                    </h2>

                    <div className="flex flex-wrap gap-2 mb-6">
                        <span className="bg-bg-dark/5 px-3 py-1.5 rounded-pill text-[10px] font-bold">
                            {new Date(booking.pickup_time).toLocaleString('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short' })}
                        </span>
                        {booking.flight_number && (
                            <span className="bg-bg-dark/5 px-3 py-1.5 rounded-pill font-mono text-[10px] font-bold">
                                ✈ {booking.flight_number}
                            </span>
                        )}
                        {!booking.flight_number && (
                            <span className="bg-bg-dark/5 px-3 py-1.5 rounded-pill text-[10px] font-bold uppercase tracking-wider">
                                Private Transfer
                            </span>
                        )}
                    </div>

                    <div className="h-1.5 bg-bg-dark/5 rounded-full overflow-hidden">
                        <div
                            className={`h-full transition-all duration-1000 ${isCompleted ? 'bg-success' : 'bg-primary'}`}
                            style={{ width: getProgressWidth() }}
                        />
                    </div>
                </div>

                {/* Driver Card */}
                {!isPending && booking.driver_name && (
                    <div className="glass-card p-6 reveal-up active stagger-2 mb-5">
                        <div className="flex items-center gap-4 mb-5">
                            <div className="bg-bg-dark text-text-cream size-14 rounded-full flex items-center justify-center font-extrabold text-2xl">
                                {booking.driver_name[0]}
                            </div>
                            <div className="flex-1">
                                <h3 className="font-extrabold text-xl tracking-tight leading-tight">{booking.driver_name.split(' ')[0]}</h3>
                                <p className="text-[10px] uppercase tracking-widest text-text-muted font-black">{booking.vehicle_type || 'Vehicle assigned'}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className={`size-2 rounded-full ${status === 'accepted' ? 'bg-[#F59E0B]' : status === 'in_progress' ? 'bg-[#00F5A0] session-pulse' : 'bg-text-muted'}`} />
                                <span className="text-xs font-bold text-text-muted">
                                    {status === 'accepted' ? 'En route to pickup' : status === 'in_progress' ? 'In transit' : 'Trip complete'}
                                </span>
                            </div>
                        </div>

                        <div className="bg-white/40 rounded-2xl p-3 flex items-start gap-3">
                            <span className="text-lg">🔒</span>
                            <p className="text-[11px] leading-relaxed text-text-muted italic">
                                Contact details structurally excluded from this session · Mediated channel
                            </p>
                        </div>
                    </div>
                )}

                {/* Chat Area */}
                <div className="reveal-up active stagger-3 flex flex-col min-h-[450px] mb-5">
                    {!isActive ? (
                        <div className="glass-card-dark flex-1 flex flex-col items-center justify-center p-8 text-center rounded-[24px]">
                            <div className="text-5xl mb-6">🔒</div>
                            <h3 className="text-xl font-bold text-text-cream mb-2">Secure channel pending</h3>
                            <p className="text-text-muted text-sm leading-relaxed">
                                Your driver will be assigned shortly. The channel opens automatically when they accept.
                            </p>
                        </div>
                    ) : (
                        <ChatWindow
                            tripId={tripId}
                            token={undefined}
                            role="client"
                            counterpartName={booking.driver_name?.split(' ')[0] || 'Driver'}
                        />
                    )}
                </div>

                {/* Complaint Form */}
                {isCompleted && (
                    <div className="reveal-up active mb-10">
                        {complaintStatus.success ? (
                            <div className="glass-card-dark reveal-up active" style={{ padding: '24px', borderRadius: '24px' }}>
                                {/* Header */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
                                    <div style={{
                                        width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                                        background: 'rgba(108,99,255,0.2)', border: '1px solid rgba(108,99,255,0.4)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '14px', color: '#A5A0FF'
                                    }}>✓</div>
                                    <div>
                                        <div style={{ fontSize: '14px', fontWeight: 800, color: '#F0F2F7' }}>Complaint Received</div>
                                        {complaintProgress && (
                                            <div style={{ fontSize: '11px', color: 'rgba(240,242,247,0.5)', marginTop: '2px' }}>
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
                                    const futureColor = 'rgba(255,255,255,0.2)';
                                    return (
                                        <>
                                            {/* Timeline dots + connectors */}
                                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                                                {steps.map((step, i) => (
                                                    <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
                                                        <div style={{
                                                            width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                                                            background: i <= current ? activeColor : futureColor,
                                                            boxShadow: i === current ? '0 0 8px rgba(108,99,255,0.7)' : 'none'
                                                        }} />
                                                        {i < steps.length - 1 && (
                                                            <div style={{ flex: 1, height: '1px', background: i < current ? activeColor : futureColor }} />
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Step labels */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                                {steps.map((step, i) => {
                                                    const isActive = i === current;
                                                    const isFuture = i > current;
                                                    return (
                                                        <span key={step} className={`reveal-up active stagger-${i + 1}`} style={{
                                                            fontSize: '10px',
                                                            fontWeight: isActive ? 800 : 600,
                                                            letterSpacing: isActive ? '-0.05em' : '0.08em',
                                                            color: isFuture ? 'rgba(255,255,255,0.2)' : '#F0F2F7',
                                                            textTransform: isActive ? 'none' : 'uppercase',
                                                            textAlign: i === 0 ? 'left' : i === 2 ? 'right' : 'center'
                                                        }}>
                                                            {step}
                                                        </span>
                                                    );
                                                })}
                                            </div>

                                            {/* Category pill */}
                                            <div style={{ marginBottom: '16px' }}>
                                                <span style={{
                                                    display: 'inline-block', fontSize: '10px', fontWeight: 700,
                                                    textTransform: 'uppercase', letterSpacing: '0.1em',
                                                    padding: '4px 12px', borderRadius: '9999px',
                                                    background: 'rgba(108,99,255,0.15)', border: '1px solid rgba(108,99,255,0.3)',
                                                    color: '#A5A0FF'
                                                }}>
                                                    {complaintProgress.category}
                                                </span>
                                            </div>

                                            {/* Info line */}
                                            <p style={{ fontSize: '12px', color: 'rgba(240,242,247,0.5)', lineHeight: 1.5 }}>
                                                Email updates will be sent as your complaint progresses.
                                            </p>
                                        </>
                                    );
                                })() : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '16px', height: '16px', border: '2px solid #6C63FF', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                        <span style={{ fontSize: '13px', color: 'rgba(240,242,247,0.5)' }}>Loading progress...</span>
                                    </div>
                                )}
                            </div>
                        ) : complaintWindowSeconds !== null && complaintWindowSeconds <= 0 ? (
                            <div className="glass-card-dark" style={{ padding: '40px 28px', borderRadius: '24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                <div style={{ fontSize: '40px' }}>⏰</div>
                                <h3 className="kinetic-text" style={{ fontSize: '20px', margin: 0 }}>Complaint Window Closed</h3>
                                <p style={{ fontSize: '13px', color: 'rgba(240,242,247,0.45)', margin: 0, lineHeight: 1.6 }}>
                                    The 24-hour window for this trip has passed.
                                </p>
                            </div>
                        ) : (
                            <div className="glass-card-dark" style={{ padding: '28px 24px', borderRadius: '24px', borderLeft: '3px solid #6C63FF' }}>
                                <style>{`.complaint-desc::placeholder { color: rgba(255,255,255,0.35); }`}</style>

                                {/* Header */}
                                <div style={{ marginBottom: '24px' }}>
                                    <h3 className="kinetic-text" style={{ fontSize: '20px', fontWeight: 800, letterSpacing: '-0.05em', color: '#F0F2F7', margin: '0 0 6px 0' }}>
                                        File a Complaint
                                    </h3>
                                    <p style={{ fontSize: '13px', color: 'rgba(240,242,247,0.45)', margin: 0, lineHeight: 1.5 }}>
                                        Your feedback is confidential and helps us maintain service standards
                                    </p>
                                </div>

                                {/* Countdown timer */}
                                {complaintWindowSeconds !== null && complaintWindowSeconds > 0 && (() => {
                                    const timerColor = complaintWindowSeconds <= 1800 ? '#EF4444' : complaintWindowSeconds <= 7200 ? '#F59E0B' : '#6C63FF';
                                    const h = Math.floor(complaintWindowSeconds / 3600);
                                    const m = Math.floor((complaintWindowSeconds % 3600) / 60);
                                    const s = complaintWindowSeconds % 60;
                                    const barPercent = Math.min(100, (complaintWindowSeconds / 86400) * 100);
                                    return (
                                        <div style={{ marginBottom: '28px' }}>
                                            <p className="kinetic-text" style={{ fontSize: '28px', fontWeight: 800, color: timerColor, margin: '0 0 10px 0', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums' }}>
                                                {h}h {String(m).padStart(2, '0')}m {String(s).padStart(2, '0')}s
                                            </p>
                                            <div style={{ width: '100%', height: '3px', borderRadius: '9999px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: '8px' }}>
                                                <div style={{
                                                    width: `${barPercent}%`, height: '100%',
                                                    background: timerColor, borderRadius: '9999px',
                                                    transition: 'width 1s linear, background 0.5s ease'
                                                }} />
                                            </div>
                                            <p style={{ fontSize: '11px', color: 'rgba(240,242,247,0.4)', margin: 0, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                                remaining to file
                                            </p>
                                        </div>
                                    );
                                })()}

                                <form onSubmit={handleComplaintSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    {/* Category pills */}
                                    <div style={{ overflowX: 'auto', margin: '0 -4px', paddingBottom: '4px' }}>
                                        <div style={{ display: 'flex', gap: '8px', padding: '0 4px', whiteSpace: 'nowrap' }}>
                                            {['Service Quality', 'Safety', 'Punctuality', 'Vehicle Condition', 'Other'].map(cat => {
                                                const selected = complaintForm.category === cat;
                                                return (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        onClick={() => setComplaintForm({ ...complaintForm, category: cat })}
                                                        style={{
                                                            padding: '8px 16px', borderRadius: '9999px',
                                                            fontSize: '12px', fontWeight: 700, flexShrink: 0,
                                                            border: selected ? 'none' : '1px solid rgba(108,99,255,0.2)',
                                                            background: selected ? '#6C63FF' : 'rgba(108,99,255,0.15)',
                                                            color: selected ? '#FFF' : '#A5A0FF',
                                                            boxShadow: selected ? '0 2px 12px rgba(108,99,255,0.4)' : 'none',
                                                            cursor: 'pointer', transition: 'all 0.15s ease'
                                                        }}
                                                    >
                                                        {cat}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Textarea with character counter */}
                                    <div style={{ position: 'relative' }}>
                                        <textarea
                                            className="complaint-desc"
                                            placeholder="Describe what happened..."
                                            value={complaintForm.description}
                                            onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value.slice(0, 500) })}
                                            onFocus={() => setDescFocused(true)}
                                            onBlur={() => setDescFocused(false)}
                                            maxLength={500}
                                            required
                                            style={{
                                                width: '100%', minHeight: '120px', padding: '16px',
                                                background: 'rgba(255,255,255,0.07)',
                                                border: `1px solid ${descFocused ? 'rgba(108,99,255,0.5)' : 'rgba(255,255,255,0.12)'}`,
                                                boxShadow: descFocused ? '0 0 0 3px rgba(108,99,255,0.1)' : 'none',
                                                borderRadius: '16px', color: '#F5EDE3',
                                                fontSize: '14px', lineHeight: 1.6,
                                                resize: 'none', outline: 'none',
                                                fontFamily: 'Inter, sans-serif',
                                                boxSizing: 'border-box', display: 'block',
                                                transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                                                paddingBottom: '32px'
                                            }}
                                        />
                                        <span style={{
                                            position: 'absolute', bottom: '12px', right: '14px',
                                            fontSize: '11px', fontWeight: 600, pointerEvents: 'none',
                                            color: complaintForm.description.length > 500 ? '#EF4444' : 'rgba(255,255,255,0.4)'
                                        }}>
                                            {complaintForm.description.length}/500
                                        </span>
                                    </div>

                                    {/* Error banner */}
                                    {complaintStatus.error && (
                                        <div className="glass-card" style={{
                                            padding: '12px 16px', borderRadius: '12px',
                                            borderLeft: '3px solid #EF4444',
                                            display: 'flex', alignItems: 'center', gap: '10px'
                                        }}>
                                            <span style={{ fontSize: '14px', flexShrink: 0 }}>⚠️</span>
                                            <p style={{ fontSize: '13px', color: '#EF4444', fontWeight: 600, margin: 0 }}>
                                                Failed to submit. Please try again.
                                            </p>
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={!complaintForm.category || !complaintForm.description.trim() || complaintForm.description.length > 500 || complaintStatus.loading}
                                        className="btn-premium btn-accent w-full"
                                        style={{ padding: '16px', borderRadius: '14px' }}
                                    >
                                        {complaintStatus.loading ? 'Submitting...' : 'Submit Complaint →'}
                                    </button>
                                </form>
                            </div>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
