import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import ChatWindow from '../components/ChatWindow';

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
    const [complaintStatus, setComplaintStatus] = useState({ loading: false, success: false });
    const [complaintForm, setComplaintForm] = useState({ category: 'Service Quality', description: '' });
    const [complaintWindowSeconds, setComplaintWindowSeconds] = useState(null);
    const [complaintProgress, setComplaintProgress] = useState(null);

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

    useEffect(() => {
        if (tripId) {
            fetchBooking();
            const interval = setInterval(fetchBooking, 10000);
            return () => clearInterval(interval);
        }
    }, [tripId, fetchBooking]);

    // Handle session_closed from socket
    useEffect(() => {
        // Socket.IO event listener for session_closed
        // Note: useChat doesn't return the socket instance directly easily, 
        // but we can listen for status changes in poll.
        // If we want immediate response to session_closed, useChat should ideally 
        // have a callback or expose the socket.
    }, []);

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
        setComplaintStatus({ loading: true, success: false });
        try {
            await api.post(`/complaints/${tripId}`, complaintForm);
            setComplaintStatus({ loading: false, success: true });
        } catch {
            setComplaintStatus({ loading: false, success: false });
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

    useEffect(() => {
        // Handled by ChatWindow
    }, []);

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
                <div className="flex items-center gap-3">
                    <div className="bg-bg-dark size-9 rounded-xl flex items-center justify-center">
                        <img src="/swiftlink-icon.png" className="size-6 object-contain" alt="Logo" />
                    </div>
                    <span className="font-extrabold tracking-tighter text-lg">SwiftLink</span>
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
                    <div className="glass-card p-7 reveal-up active mb-10">
                        {complaintStatus.success ? (
                            <div className="glass-card" style={{ padding: '24px', borderRadius: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#00F5A0', boxShadow: '0 0 8px rgba(0,245,160,0.6)' }} />
                                    <span style={{ fontSize: '14px', fontWeight: 800, color: '#0D0D0D' }}>Complaint Submitted</span>
                                </div>

                                {complaintProgress ? (() => {
                                    const statusConfig = {
                                        open: { label: 'Open', color: '#F59E0B', width: '25%' },
                                        under_investigation: { label: 'Under Investigation', color: '#6C63FF', width: '50%' },
                                        resolved: { label: 'Resolved', color: '#00F5A0', width: '100%' },
                                        escalated: { label: 'Escalated', color: '#E05A5A', width: '75%' }
                                    };
                                    const cfg = statusConfig[complaintProgress.status] || statusConfig.open;
                                    return (
                                        <>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                                <span style={{
                                                    fontSize: '11px', fontWeight: 700, textTransform: 'uppercase',
                                                    letterSpacing: '0.15em', color: cfg.color,
                                                    padding: '4px 12px', borderRadius: '50px',
                                                    background: `${cfg.color}15`, border: `1px solid ${cfg.color}30`
                                                }}>{cfg.label}</span>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                                                    {new Date(complaintProgress.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div style={{ height: '6px', background: 'rgba(13,13,13,0.06)', borderRadius: '3px', overflow: 'hidden', marginBottom: '12px' }}>
                                                <div style={{ height: '100%', width: cfg.width, background: cfg.color, borderRadius: '3px', transition: 'width 0.6s ease' }} />
                                            </div>
                                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                                Category: {complaintProgress.category} · Status updates are sent to your corporate email.
                                            </p>
                                        </>
                                    );
                                })() : (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div style={{ width: '16px', height: '16px', border: '2px solid #6C63FF', borderTop: '2px solid transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Loading progress...</span>
                                    </div>
                                )}
                            </div>
                        ) : complaintWindowSeconds !== null && complaintWindowSeconds <= 0 ? (
                            <div className="bg-bg-dark/5 border border-black/5 rounded-2xl p-6 text-center">
                                <div className="text-3xl mb-2">⏰</div>
                                <p className="font-bold text-text-muted text-sm uppercase tracking-wider">Complaint Window Closed</p>
                                <p className="text-text-muted text-xs mt-1">Privacy policy: Communication archives purged.</p>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between items-end mb-6">
                                    <h3 className="font-extrabold text-xl">File a Complaint</h3>
                                    <span className="text-text-muted text-[10px] font-bold uppercase tracking-widest bg-bg-dark/5 px-2 py-1 rounded">
                                        {complaintWindowSeconds ? (() => {
                                            const h = Math.floor(complaintWindowSeconds / 3600);
                                            const m = Math.floor((complaintWindowSeconds % 3600) / 60);
                                            const s = complaintWindowSeconds % 60;
                                            return `${h}h ${m}m ${s}s left`;
                                        })() : '24h Window'}
                                    </span>
                                </div>

                                <form onSubmit={handleComplaintSubmit} className="space-y-6">
                                    <div className="overflow-x-auto -mx-2 pb-2">
                                        <div className="flex gap-2 px-2 whitespace-nowrap">
                                            {['Service Quality', 'Safety', 'Punctuality', 'Vehicle Condition', 'Other'].map(cat => (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    onClick={() => setComplaintForm({ ...complaintForm, category: cat })}
                                                    className={`px-4 py-2 rounded-pill text-[11px] font-bold tracking-tight transition-all ${complaintForm.category === cat ? 'bg-bg-dark text-white' : 'bg-white/40 border border-black/5 text-text-muted'}`}
                                                >
                                                    {cat}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <textarea
                                        placeholder="Describe what happened..."
                                        value={complaintForm.description}
                                        onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })}
                                        className="w-full bg-white/40 border border-white/60 rounded-input p-4 text-sm resize-none min-h-[120px] focus:ring-1 focus:ring-primary outline-none transition-all"
                                        required
                                    />

                                    <button
                                        type="submit"
                                        disabled={complaintStatus.loading}
                                        className="btn-premium btn-accent w-full py-4 rounded-xl flex items-center justify-center gap-2"
                                    >
                                        {complaintStatus.loading ? 'Submitting...' : 'Submit Complaint →'}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
