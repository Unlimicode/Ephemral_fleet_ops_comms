import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GlassCard from '../components/layout/GlassCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../api/axios.js';

// LoginPage provides a single entry point for both fleet managers and drivers.
// The role selector determines which backend endpoint is called and which home
// route the user is redirected to on success.
export default function LoginPage() {
    const [role, setRole] = useState('fleet_manager');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { login } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        setError('');

        const endpoint =
            role === 'fleet_manager' ? '/api/auth/login' : '/api/drivers/auth/login';

        try {
            const res = await api.post(endpoint, { email, password });
            const { token, user } = res.data;
            login(token, role, user);
            navigate(role === 'fleet_manager' ? '/manager/dispatch' : '/driver/trips', {
                replace: true,
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Login failed. Check your credentials.');
        } finally {
            setLoading(false);
        }
    }

    const inputClass =
        'w-full px-4 py-3 rounded-xl border text-sm font-medium outline-none transition-all duration-300 bg-white/60';

    const inputStyle = {
        borderColor: 'rgba(108, 99, 255, 0.2)',
        color: 'var(--text-primary)',
        fontFamily: 'Inter, sans-serif',
    };

    return (
        <div
            className="min-h-screen flex items-center justify-center"
            style={{ backgroundColor: 'var(--bg-base)' }}
        >
            <div className="w-full max-w-md px-4">
                <GlassCard className="p-8">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <h1 className="gradient-text text-4xl font-bold tracking-tight mb-1">
                            Swiftlink
                        </h1>
                        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                            Fleet Operations Platform
                        </p>
                    </div>

                    {/* Role selector */}
                    <div className="flex gap-2 mb-6 p-1 rounded-full" style={{ background: 'rgba(108,99,255,0.06)' }}>
                        {[
                            { value: 'fleet_manager', label: 'Fleet Manager' },
                            { value: 'driver', label: 'Driver' },
                        ].map(({ value, label }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => setRole(value)}
                                className="flex-1 py-2 rounded-full text-sm font-semibold transition-all duration-300"
                                style={
                                    role === value
                                        ? { background: 'var(--accent-gradient)', color: '#fff' }
                                        : { color: 'var(--text-secondary)' }
                                }
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <input
                            type="email"
                            placeholder="Work email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className={inputClass}
                            style={inputStyle}
                            required
                            autoComplete="email"
                        />
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={inputClass}
                            style={inputStyle}
                            required
                            autoComplete="current-password"
                        />

                        {error && (
                            <p className="text-sm font-medium text-center" style={{ color: 'var(--accent-warning)' }}>
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all duration-300 mt-2"
                            style={{
                                background: 'var(--accent-gradient)',
                                opacity: loading ? 0.6 : 1,
                                cursor: loading ? 'not-allowed' : 'pointer',
                            }}
                        >
                            {loading ? 'Signing in…' : 'Sign In'}
                        </button>
                    </form>
                </GlassCard>
            </div>
        </div>
    );
}
