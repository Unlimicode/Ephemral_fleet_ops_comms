import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';

const formatTimeAgo = (iso) => {
    const mins = Math.floor((Date.now() - new Date(iso)) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    if (mins < 1440) return Math.floor(mins / 60) + 'h ago';
    return Math.floor(mins / 1440) + 'd ago';
};

const TypeIcon = ({ type }) => {
    const configs = {
        trip_assigned: { bg: 'rgba(108,99,255,0.1)', icon: 'directions_car', color: '#6C63FF' },
        complaint_review: { bg: 'rgba(224,90,90,0.1)', icon: 'report', color: '#E05A5A' },
    };
    const cfg = configs[type] || { bg: 'rgba(0,0,0,0.06)', icon: 'notifications', color: 'rgba(0,0,0,0.4)' };
    return (
        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: cfg.bg, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: cfg.color }}>{cfg.icon}</span>
        </div>
    );
};

const SkeletonCard = () => (
    <div className="notif-card" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(0,0,0,0.06)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
                <div style={{ height: '14px', background: 'rgba(0,0,0,0.07)', borderRadius: '6px', width: '55%', marginBottom: '10px' }} />
                <div style={{ height: '12px', background: 'rgba(0,0,0,0.05)', borderRadius: '6px', width: '80%', marginBottom: '8px' }} />
                <div style={{ height: '10px', background: 'rgba(0,0,0,0.04)', borderRadius: '6px', width: '25%' }} />
            </div>
        </div>
    </div>
);

export default function DriverNotificationsPage() {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    const unreadCount = notifications.filter(n => !n.read).length;

    useEffect(() => {
        api.get('/drivers/notifications')
            .then(res => setNotifications(res.data.notifications))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const markAsRead = async (id) => {
        try {
            await api.patch(`/drivers/notifications/${id}/read`);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
        } catch {
            // best-effort
        }
    };

    const handleCardClick = async (n) => {
        if (!n.read) await markAsRead(n.id);
        if (n.trip_id) navigate(`/driver/trips/${n.trip_id}`);
    };

    return (
        <>
            <style>{`
                .notif-card {
                    background: rgba(255,255,255,0.55);
                    backdrop-filter: blur(40px) saturate(180%);
                    -webkit-backdrop-filter: blur(40px) saturate(180%);
                    border: 1px solid rgba(255,255,255,0.7);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.08);
                    border-radius: 1.5rem;
                    transition: transform 0.2s ease;
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

            {/* Fixed background layer */}
            <div className="fixed inset-0 arch-grid opacity-40 pointer-events-none" style={{ zIndex: 0, backgroundSize: '60px 60px', backgroundImage: 'linear-gradient(to right, rgba(13,13,13,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(13,13,13,0.05) 1px, transparent 1px)' }} />
            <div className="geo-float-1" style={{ position: 'fixed', top: '8%', right: '-4%', zIndex: 0, pointerEvents: 'none' }}>
                <div style={{ width: '90px', height: '90px', background: 'rgba(108,99,255,0.06)', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
            </div>
            <div className="geo-float-2" style={{ position: 'fixed', bottom: '10%', left: '-5%', zIndex: 0, pointerEvents: 'none' }}>
                <div style={{ width: '80px', height: '80px', background: 'rgba(13,13,13,0.04)', clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)' }} />
            </div>

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 1, maxWidth: '900px', margin: '0 auto', padding: '20px 16px', fontFamily: "'Be Vietnam Pro', sans-serif" }}>

                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '28px', fontWeight: 900, letterSpacing: '-0.03em', color: '#0D0D0D', margin: 0 }}>
                        Notifications
                    </h1>
                    {unreadCount > 0 && (
                        <span style={{ background: 'rgba(108,99,255,0.1)', color: '#6C63FF', borderRadius: '999px', padding: '4px 12px', fontSize: '12px', fontWeight: 700, marginLeft: '12px' }}>
                            {unreadCount} unread
                        </span>
                    )}
                </div>

                {/* Loading skeletons */}
                {loading && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <SkeletonCard />
                        <SkeletonCard />
                        <SkeletonCard />
                    </div>
                )}

                {/* Empty state */}
                {!loading && notifications.length === 0 && (
                    <div className="notif-card" style={{ padding: '48px', textAlign: 'center' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(108,99,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <span className="material-symbols-outlined" style={{ fontSize: '28px', color: 'rgba(108,99,255,0.4)' }}>notifications_off</span>
                        </div>
                        <p style={{ fontSize: '15px', fontWeight: 600, color: '#0D0D0D', margin: '0 0 6px' }}>No notifications yet</p>
                        <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.4)', margin: 0 }}>Push notifications will appear here</p>
                    </div>
                )}

                {/* Notification list */}
                {!loading && notifications.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {notifications.map(n => (
                            <div
                                key={n.id}
                                className="notif-card"
                                onClick={() => handleCardClick(n)}
                                style={{
                                    padding: '20px 24px',
                                    borderLeft: n.read ? '3px solid transparent' : '3px solid #6C63FF',
                                    background: n.read ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.75)',
                                    opacity: n.read ? 0.8 : 1,
                                    cursor: n.trip_id ? 'pointer' : 'default',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                                    <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', flex: 1 }}>
                                        <TypeIcon type={n.type} />
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: '14px', fontWeight: 700, color: '#0D0D0D', margin: 0 }}>{n.title}</p>
                                            <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.55)', marginTop: '4px', lineHeight: 1.4, margin: '4px 0 0' }}>{n.body}</p>
                                            <p style={{ fontSize: '11px', color: 'rgba(0,0,0,0.35)', marginTop: '6px', fontFamily: "'JetBrains Mono', monospace", margin: '6px 0 0' }}>{formatTimeAgo(n.created_at)}</p>
                                        </div>
                                    </div>
                                    <div style={{ flexShrink: 0, paddingTop: '2px' }}>
                                        {!n.read ? (
                                            <button
                                                onClick={() => markAsRead(n.id)}
                                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: '#6C63FF', padding: 0 }}
                                            >
                                                Mark read
                                            </button>
                                        ) : (
                                            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: 'rgba(0,200,0,0.4)' }}>check_circle</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}
