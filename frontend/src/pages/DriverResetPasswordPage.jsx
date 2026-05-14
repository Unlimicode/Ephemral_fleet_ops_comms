import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../api/axios.js';
import SwiftlinkLogo from '../components/SwiftlinkLogo.jsx';

export default function DriverResetPasswordPage() {
    const { token } = useParams();
    const navigate = useNavigate();

    const [validating, setValidating] = useState(true);
    const [valid, setValid] = useState(false);
    const [driverName, setDriverName] = useState('');
    const [driverEmail, setDriverEmail] = useState('');
    const [validationError, setValidationError] = useState('');

    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState('');
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        let mounted = true;
        api.get(`/drivers/auth/reset/${token}`)
            .then(res => {
                if (!mounted) return;
                setValid(true);
                setDriverName(res.data.driver_name || '');
                setDriverEmail(res.data.driver_email || '');
            })
            .catch(err => {
                if (!mounted) return;
                setValid(false);
                setValidationError(err.response?.data?.error || 'Invalid or expired reset link.');
            })
            .finally(() => mounted && setValidating(false));
        return () => { mounted = false; };
    }, [token]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitError('');

        if (password.length < 8) {
            setSubmitError('Password must be at least 8 characters.');
            return;
        }
        if (password !== confirm) {
            setSubmitError('Passwords do not match.');
            return;
        }

        setSubmitting(true);
        try {
            await api.post(`/drivers/auth/reset/${token}`, { password });
            setSuccess(true);
            setTimeout(() => navigate('/login', { replace: true }), 1800);
        } catch (err) {
            setSubmitError(err.response?.data?.error || 'Could not update password.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5EDE3', padding: '20px', fontFamily: "'Be Vietnam Pro', sans-serif" }}>
            <div style={{
                width: '100%', maxWidth: '440px',
                background: 'rgba(255,255,255,0.55)',
                backdropFilter: 'blur(40px)',
                WebkitBackdropFilter: 'blur(40px)',
                border: '1px solid rgba(255,255,255,0.7)',
                borderRadius: '24px', padding: '40px',
                boxShadow: '0 20px 60px rgba(0,0,0,0.06)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '28px' }}>
                    <SwiftlinkLogo height={32} />
                    <span style={{ fontWeight: 900, fontSize: '17px', letterSpacing: '-0.03em' }}>SwiftLink</span>
                </div>

                {validating && (
                    <p style={{ fontSize: '14px', color: 'rgba(0,0,0,0.5)' }}>Validating link…</p>
                )}

                {!validating && !valid && (
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 12px', letterSpacing: '-0.02em' }}>Link not valid</h1>
                        <p style={{ fontSize: '14px', color: '#E05A5A', margin: '0 0 24px' }}>{validationError}</p>
                        <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', margin: '0 0 24px' }}>
                            Ask your fleet manager to issue a new reset link.
                        </p>
                        <Link to="/login" style={{ display: 'inline-block', background: '#0D0D0D', color: '#F5EDE3', padding: '12px 24px', borderRadius: '12px', textDecoration: 'none', fontWeight: 700, fontSize: '13px' }}>
                            Back to login
                        </Link>
                    </div>
                )}

                {!validating && valid && success && (
                    <div>
                        <h1 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 12px', letterSpacing: '-0.02em', color: '#00A86B' }}>Password updated</h1>
                        <p style={{ fontSize: '14px', color: 'rgba(0,0,0,0.6)' }}>Redirecting you to the login page…</p>
                    </div>
                )}

                {!validating && valid && !success && (
                    <>
                        <h1 style={{ fontSize: '24px', fontWeight: 900, margin: '0 0 8px', letterSpacing: '-0.02em' }}>Set a new password</h1>
                        <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.55)', margin: '0 0 24px' }}>
                            Hi {driverName.split(' ')[0] || 'there'} — choose a new password for <strong>{driverEmail}</strong>.
                        </p>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.5)', marginBottom: '6px' }}>New password</label>
                                <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                                    style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.85)', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.5)', marginBottom: '6px' }}>Confirm password</label>
                                <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8}
                                    style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', border: '1px solid rgba(0,0,0,0.12)', background: 'rgba(255,255,255,0.85)', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }} />
                            </div>
                            {submitError && <p style={{ fontSize: '13px', color: '#E05A5A', margin: 0 }}>{submitError}</p>}
                            <button type="submit" disabled={submitting} style={{ background: '#0D0D0D', color: '#F5EDE3', border: 'none', borderRadius: '12px', padding: '12px', fontWeight: 700, fontSize: '14px', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.6 : 1 }}>
                                {submitting ? 'Saving…' : 'Update password'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}
