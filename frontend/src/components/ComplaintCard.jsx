import { useState, useEffect } from 'react';

const CATEGORIES = ['Service Quality', 'Safety', 'Punctuality', 'Vehicle Condition', 'Other'];

export default function ComplaintCard({
    complaintWindowSeconds: initialSeconds = 86400,
    onSubmit,
    loading = false,
    error = false,
    offline = false,
}) {
    const [category, setCategory] = useState('');
    const [description, setDescription] = useState('');
    const [focused, setFocused] = useState(false);
    const [seconds, setSeconds] = useState(initialSeconds);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (seconds <= 0) return;
        const t = setInterval(() => setSeconds(s => (s > 0 ? s - 1 : 0)), 1000);
        return () => clearInterval(t);
    }, []);

    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;

    const timerColor =
        seconds <= 1800 ? '#EF4444' :
        seconds <= 7200 ? '#F59E0B' :
        'var(--accent-primary, #6C63FF)';

    const barPct = Math.min(100, (seconds / 86400) * 100);
    const canSubmit = category && description.trim() && description.length <= 500 && !loading;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!canSubmit) return;
        await onSubmit?.({ category, description });
        setSubmitted(true);
    };

    if (seconds <= 0) {
        return (
            <div className="glass-card" style={{ padding: '40px 28px', borderRadius: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '40px' }}>⏰</div>
                <h3 className="kinetic-text" style={{ fontSize: '20px', margin: 0 }}>Complaint Window Closed</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>The 24-hour window for this trip has passed.</p>
            </div>
        );
    }

    if (submitted) {
        return (
            <div className="glass-card" style={{ padding: '40px 28px', borderRadius: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                <div style={{ fontSize: '40px' }}>✅</div>
                <h3 className="kinetic-text" style={{ fontSize: '20px', margin: 0 }}>Complaint Received</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>Our team will review your complaint within 48 hours.</p>
                <span style={{ fontSize: '11px', fontWeight: 700, background: 'rgba(108,99,255,0.12)', color: 'var(--accent-primary, #6C63FF)', padding: '4px 14px', borderRadius: '9999px', border: '1px solid rgba(108,99,255,0.2)' }}>
                    {category}
                </span>
            </div>
        );
    }

    return (
        <>
            <style>{`
                .complaint-ta::placeholder { color: rgba(0,0,0,0.3); }
                .complaint-cats { display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none; -ms-overflow-style: none; }
                .complaint-cats::-webkit-scrollbar { display: none; }
                @keyframes complaint-shimmer {
                    0%   { background-position: 200% center; }
                    100% { background-position: -200% center; }
                }
                @keyframes complaint-pulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(108,99,255,0.4); }
                    50%      { box-shadow: 0 0 12px 3px rgba(108,99,255,0.2); }
                }
            `}</style>

            <div className="glass-card" style={{ padding: '32px 28px', borderRadius: '2rem' }}>

                <div style={{ marginBottom: '28px' }}>
                    <h3 className="kinetic-text" style={{ fontSize: '21px', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                        File a Complaint
                    </h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                        Your feedback is confidential and helps us maintain service standards
                    </p>
                </div>

                <div style={{ marginBottom: '28px', padding: '18px 20px', background: 'rgba(0,0,0,0.04)', borderRadius: '18px', border: '1px solid rgba(0,0,0,0.06)' }}>
                    <p className="kinetic-text" style={{ fontSize: '32px', fontWeight: 900, color: timerColor, margin: '0 0 14px', letterSpacing: '-0.04em', fontVariantNumeric: 'tabular-nums', lineHeight: 1, transition: 'color 0.5s ease' }}>
                        {h}h {String(m).padStart(2, '0')}m {String(s).padStart(2, '0')}s
                    </p>
                    <div style={{ width: '100%', height: '8px', borderRadius: '9999px', background: 'rgba(0,0,0,0.08)', overflow: 'hidden', marginBottom: '10px', position: 'relative' }}>
                        <div style={{
                            position: 'absolute', inset: 0,
                            width: `${barPct}%`, height: '100%', borderRadius: '9999px',
                            background: `linear-gradient(90deg, ${timerColor}, ${timerColor}bb, ${timerColor})`,
                            backgroundSize: '200% 100%',
                            animation: 'complaint-shimmer 2.5s linear infinite, complaint-pulse 2s ease-in-out infinite',
                            transition: 'width 1s linear, background 0.5s ease',
                        }} />
                    </div>
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                        remaining to file
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    <div>
                        <p style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)', margin: '0 0 10px' }}>
                            Category
                        </p>
                        <div style={{ background: 'rgba(0,0,0,0.04)', borderRadius: '14px', padding: '6px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                            <div className="complaint-cats">
                                {CATEGORIES.map(cat => {
                                    const sel = category === cat;
                                    return (
                                        <button key={cat} type="button" onClick={() => setCategory(cat)} style={{
                                            padding: '8px 14px', borderRadius: '10px', fontSize: '12px',
                                            fontWeight: 700, flexShrink: 0, border: 'none', cursor: 'pointer',
                                            background: sel ? 'var(--bg-dark, #0D0D0D)' : 'transparent',
                                            color: sel ? 'var(--text-cream, #F5EDE3)' : 'var(--text-secondary)',
                                            boxShadow: sel ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
                                            transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            {cat}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div style={{ position: 'relative' }}>
                        <textarea
                            className="complaint-ta"
                            placeholder="Describe what happened..."
                            value={description}
                            onChange={e => setDescription(e.target.value.slice(0, 500))}
                            onFocus={() => setFocused(true)}
                            onBlur={() => setFocused(false)}
                            maxLength={500}
                            required
                            style={{
                                width: '100%', minHeight: '120px',
                                padding: '14px 16px', paddingBottom: '34px',
                                background: focused ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)',
                                border: `1.5px solid ${focused ? 'rgba(108,99,255,0.5)' : 'rgba(0,0,0,0.12)'}`,
                                boxShadow: focused ? '0 0 0 3px rgba(108,99,255,0.1)' : 'none',
                                borderRadius: '14px', color: 'var(--text-primary)',
                                fontSize: '14px', lineHeight: 1.6, resize: 'none',
                                outline: 'none', fontFamily: 'inherit',
                                boxSizing: 'border-box', display: 'block',
                                transition: 'all 0.2s ease',
                            }}
                        />
                        <span style={{ position: 'absolute', bottom: '12px', right: '14px', fontSize: '11px', fontWeight: 600, pointerEvents: 'none', color: description.length > 450 ? '#EF4444' : 'var(--text-muted)' }}>
                            {description.length}/500
                        </span>
                    </div>

                    {error && (
                        <div className="glass-card" style={{ padding: '12px 16px', borderRadius: '12px', borderLeft: '3px solid #EF4444', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span>⚠️</span>
                            <p style={{ fontSize: '13px', color: '#EF4444', fontWeight: 600, margin: 0 }}>Failed to submit. Please try again.</p>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={!canSubmit}
                        style={{
                            width: '100%', padding: '16px', borderRadius: '14px', border: 'none',
                            background: canSubmit ? 'var(--bg-dark, #0D0D0D)' : 'rgba(0,0,0,0.08)',
                            color: canSubmit ? 'var(--text-cream, #F5EDE3)' : 'var(--text-muted)',
                            fontSize: '14px', fontWeight: 700, cursor: canSubmit ? 'pointer' : 'not-allowed',
                            fontFamily: 'inherit', transition: 'all 0.2s ease',
                        }}
                    >
                        {loading ? 'Submitting…' : offline ? 'Queue Complaint →' : 'Submit Complaint →'}
                    </button>
                </form>
            </div>
        </>
    );
}
