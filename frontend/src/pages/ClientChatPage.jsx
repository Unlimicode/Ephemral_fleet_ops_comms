import { useParams, useSearchParams } from 'react-router-dom';
import ChatWindow from '../components/ChatWindow';

export default function ClientChatPage() {
    const { tripId } = useParams();
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');

    if (!token) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--bg-base)',
                padding: '24px'
            }}>
                <div className="glass-card" style={{ padding: '32px', textAlign: 'center', maxWidth: '400px' }}>
                    <span style={{ fontSize: '48px', marginBottom: '16px', display: 'block' }}>⚠️</span>
                    <p style={{ color: 'var(--text-dark)', fontWeight: 600 }}>Invalid or expired link.</p>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '8px' }}>
                        Please request a new magic link from your original booking channel.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-base)',
            display: 'flex', flexDirection: 'column',
            position: 'relative', overflow: 'hidden'
        }}>
            {/* Background Blobs matching login/driver page */}
            <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
                <div className="glass-blob">
                    <div style={{
                        position: 'absolute', bottom: '-15%', left: '-10%', width: '650px', height: '650px',
                        borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,180,140,0.75) 0%, rgba(230,160,110,0.75) 40%, transparent 70%)',
                        filter: 'blur(20px)', mixBlendMode: 'multiply',
                        animation: 'blobFloat1 14s ease-in-out infinite, blobPulse 7s ease-in-out infinite, glassShimmer 6s ease-in-out infinite'
                    }} />
                </div>
                <div className="glass-blob">
                    <div style={{
                        position: 'absolute', top: '-10%', left: '30%', width: '400px', height: '400px',
                        borderRadius: '50%', background: 'radial-gradient(circle, rgba(240,200,170,0.65) 0%, transparent 70%)',
                        filter: 'blur(22px)', mixBlendMode: 'multiply',
                        animation: 'blobFloat2 18s ease-in-out infinite, blobPulse 9s ease-in-out infinite, glassShimmer 8s ease-in-out infinite 1s'
                    }} />
                </div>
                <div className="glass-blob">
                    <div style={{
                        position: 'absolute', top: '10%', right: '5%', width: '300px', height: '300px',
                        borderRadius: '50%', background: 'radial-gradient(circle, rgba(108,99,255,0.5) 0%, transparent 70%)',
                        filter: 'blur(25px)', mixBlendMode: 'multiply',
                        animation: 'blobFloat3 22s ease-in-out infinite, blobPulse 11s ease-in-out infinite, glassShimmer 10s ease-in-out infinite 2s'
                    }} />
                </div>
            </div>

            {/* Header */}
            <nav style={{
                padding: '20px 24px',
                display: 'flex', alignItems: 'center', gap: '8px',
                position: 'relative', zIndex: 10
            }}>
                <img src="/swiftlink-icon.png" alt="S" style={{ height: '32px' }} />
                <span style={{
                    fontSize: '1.2rem', fontWeight: 800,
                    color: '#0D0D0D', fontFamily: 'Inter, sans-serif'
                }}>wiftlink</span>
            </nav>

            {/* Main content */}
            <div style={{
                flex: 1, padding: '0 24px 24px',
                maxWidth: '600px', width: '100%',
                margin: '0 auto', position: 'relative', zIndex: 1,
                display: 'flex', flexDirection: 'column', gap: '16px'
            }}>
                <div>
                    <h1 style={{
                        fontSize: '24px', fontWeight: 800,
                        color: 'var(--text-dark)', letterSpacing: '-0.5px'
                    }}>Your Transfer</h1>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        Communicate with your driver through this secure channel.
                        Your contact details are never shared.
                    </p>
                </div>

                <div style={{ flex: 1, minHeight: '400px' }}>
                    <ChatWindow
                        tripId={tripId}
                        token={token}
                        role="client"
                        counterpartName="Driver"
                    />
                </div>
            </div>
        </div>
    );
}
