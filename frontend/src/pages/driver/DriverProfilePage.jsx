import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import PushNotificationToggle from '../../components/PushNotificationToggle.jsx';
import useInstallPrompt from '../../hooks/useInstallPrompt.js';
import api from '../../api/axios.js';

export default function DriverProfilePage() {
    const { user, token, logout } = useAuth();
    const navigate = useNavigate();
    const { canInstall, install, dismiss } = useInstallPrompt();
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/drivers/me')
            .then(r => setProfile(r.data))
            .catch(() => setProfile(null))
            .finally(() => setLoading(false));
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    const sh = (w, h, mb = 0) => ({
        background: 'linear-gradient(90deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.10) 50%, rgba(0,0,0,0.05) 100%)',
        backgroundSize: '200% 100%',
        animation: 'shimmer 1.5s infinite linear',
        borderRadius: '8px',
        width: w, height: h, marginBottom: mb || undefined,
    });

    const name = profile?.full_name || user?.full_name || user?.name || 'Driver';
    const initial = name.charAt(0).toUpperCase();

    return (
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '600px' }}>
            <style>{`@keyframes shimmer { 0% { background-position: 200% center; } 100% { background-position: -200% center; } }`}</style>

            <h1 className="kinetic-text reveal-up" style={{
                fontSize: '24px', fontWeight: 800, color: 'var(--text-dark)',
                fontFamily: "'Be Vietnam Pro', sans-serif", letterSpacing: '-0.5px', margin: 0
            }}>
                Profile
            </h1>

            {/* Identity card */}
            <div className="glass-card reveal-up stagger-1" style={{ padding: '24px', borderRadius: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                    <div style={{
                        width: '64px', height: '64px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #6C63FF, #00D4FF)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#FFF', fontSize: '24px', fontWeight: 800, flexShrink: 0,
                    }}>
                        {loading ? '?' : initial}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        {loading ? (
                            <>
                                <div style={sh('60%', '20px', 8)} />
                                <div style={sh('40%', '13px', 0)} />
                            </>
                        ) : (
                            <>
                                <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-dark)', margin: '0 0 4px' }}>
                                    {name}
                                </h2>
                                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                                    {profile?.employee_id || user?.id?.slice(0, 8)?.toUpperCase()}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* Info rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(255,255,255,0.4)', padding: '16px', borderRadius: '16px', marginBottom: '20px' }}>
                    {loading ? (
                        <>
                            <div style={sh('80%', '13px', 4)} />
                            <div style={sh('60%', '13px', 0)} />
                        </>
                    ) : (
                        <>
                            <InfoRow label="Work Email" value={profile?.work_email || user?.email} />
                            {profile?.fleet_manager_name && (
                                <InfoRow label="Fleet Manager" value={profile.fleet_manager_name} />
                            )}
                            <InfoRow
                                label="Availability"
                                value={profile?.availability_status === 'available' ? 'Available' : 'On Trip'}
                                valueColor={profile?.availability_status === 'available' ? '#10b981' : '#f59e0b'}
                            />
                        </>
                    )}
                </div>

                {/* Active trip */}
                {!loading && profile?.active_trip && (
                    <div
                        onClick={() => navigate(`/driver/trips/${profile.active_trip.id}`)}
                        style={{
                            background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)',
                            borderRadius: '16px', padding: '14px 16px', marginBottom: '20px', cursor: 'pointer',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}
                    >
                        <div>
                            <div style={{ fontSize: '10px', fontWeight: 700, color: '#6C63FF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                                Active Trip · {profile.active_trip.status.replace('_', ' ')}
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)' }}>
                                {profile.active_trip.pickup_location} → {profile.active_trip.destination}
                            </div>
                        </div>
                        <span style={{ fontSize: '18px' }}>→</span>
                    </div>
                )}

                {/* PWA install prompt */}
                {canInstall && (
                    <div style={{
                        background: 'rgba(108,99,255,0.07)',
                        border: '1px solid rgba(108,99,255,0.18)',
                        borderRadius: '16px',
                        padding: '14px 16px',
                        marginBottom: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                    }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#6C63FF', flexShrink: 0 }}>install_mobile</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0D0D0D', marginBottom: '2px' }}>Install SwiftLink</div>
                            <div style={{ fontSize: '11px', color: 'rgba(0,0,0,0.45)' }}>Add to home screen for offline access</div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                            <button
                                onClick={dismiss}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: 'rgba(0,0,0,0.35)', padding: '4px', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                            >
                                Not now
                            </button>
                            <button
                                onClick={install}
                                style={{
                                    background: '#6C63FF', color: '#FFF', border: 'none', borderRadius: '10px',
                                    padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                    fontFamily: "'Be Vietnam Pro', sans-serif",
                                }}
                            >
                                Install
                            </button>
                        </div>
                    </div>
                )}

                {/* Push toggle */}
                <div style={{ marginBottom: '20px' }}>
                    <PushNotificationToggle token={token} />
                </div>

                {/* Session + logout */}
                <div style={{ borderTop: '1px solid rgba(13,13,13,0.08)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Session</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="session-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-success)' }} />
                            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-success)', textTransform: 'uppercase' }}>Active</span>
                        </div>
                    </div>
                    <button onClick={handleLogout} style={{
                        width: '100%', padding: '16px', borderRadius: '16px',
                        background: 'rgba(13,13,13,0.85)', backdropFilter: 'blur(20px)',
                        color: '#F5EDE3', fontSize: '15px', fontWeight: 700,
                        border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer',
                        boxShadow: '0 4px 16px rgba(13,13,13,0.15)', fontFamily: "'Be Vietnam Pro', sans-serif",
                    }}>
                        Logout Securely
                    </button>
                </div>
            </div>
        </div>
    );
}

function InfoRow({ label, value, valueColor }) {
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0 }}>
                {label}
            </span>
            <span style={{ fontSize: '13px', color: valueColor || 'var(--text-dark)', fontWeight: 600, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {value || '—'}
            </span>
        </div>
    );
}
