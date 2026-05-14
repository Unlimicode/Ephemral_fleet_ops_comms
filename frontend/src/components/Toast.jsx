import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
    const [toast, setToast] = useState(null);

    // Stable reference — must not be recreated on each render, otherwise any
    // consumer that uses addToast in a useEffect or useCallback dependency
    // will infinite-loop (new addToast → new callback → effect re-fires).
    const addToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    }, []);

    const ctxValue = useMemo(() => ({ addToast }), [addToast]);

    return (
        <ToastContext.Provider value={ctxValue}>
            {children}
            {toast && (
                <div style={{
                    position: 'fixed',
                    bottom: '90px', // Above bottom tab bar on mobile
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 100,
                    animation: 'fade-in-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                    width: 'max-content',
                    maxWidth: '90vw'
                }}>
                    <div className="glass-card" style={{
                        padding: '14px 20px',
                        borderRadius: '14px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        border: `1px solid ${toast.type === 'success' ? 'rgba(0,245,160,0.4)' : 'rgba(255,100,100,0.4)'}`,
                        boxShadow: `0 8px 32px ${toast.type === 'success' ? 'rgba(0,245,160,0.1)' : 'rgba(255,100,100,0.1)'}`
                    }}>
                        <span style={{ fontSize: '18px' }}>{toast.type === 'success' ? '✓' : '⚠️'}</span>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-dark)' }}>
                            {toast.message}
                        </span>
                    </div>
                </div>
            )}
            <style>{`
                @keyframes fade-in-up {
                    0% { opacity: 0; transform: translate(-50%, 20px) scale(0.95); }
                    100% { opacity: 1; transform: translate(-50%, 0) scale(1); }
                }
            `}</style>
        </ToastContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
