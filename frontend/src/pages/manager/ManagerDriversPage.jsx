import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios.js';
import { useToast } from '../../components/Toast.jsx';
import useWindowWidth from '../../hooks/useWindowWidth.js';

const getInitials = (name) => {
    const parts = (name || '').split(' ');
    return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
};

export default function ManagerDriversPage() {
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [showReactivateModal, setShowReactivateModal] = useState(false);
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [newDriver, setNewDriver] = useState({ full_name: '', work_email: '', password: '', employee_id: '' });
    const [formError, setFormError] = useState('');
    const { addToast } = useToast();
    const width = useWindowWidth();
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1024;

    const fetchDrivers = useCallback(async () => {
        try {
            const res = await api.get('/roster/drivers');
            setDrivers(Array.isArray(res.data) ? res.data : []);
            setError(false);
        } catch (err) {
            console.error('Failed to fetch drivers:', err);
            setError(true);
            addToast('Could not load driver roster.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchDrivers();
        const interval = setInterval(fetchDrivers, 30000);
        return () => clearInterval(interval);
    }, [fetchDrivers]);

    async function handleAddDriver(e) {
        e.preventDefault();
        setFormError('');
        try {
            await api.post('/roster/drivers', newDriver);
            addToast('Driver added successfully.', 'success');
            setShowAddModal(false);
            setNewDriver({ full_name: '', work_email: '', password: '', employee_id: '' });
            fetchDrivers();
        } catch (err) {
            setFormError(err.response?.data?.error || 'Failed to add driver.');
        }
    }

    async function handleReactivate() {
        if (!selectedDriver) return;
        try {
            await api.patch(`/roster/drivers/${selectedDriver.driver_id}/reactivate`);
            addToast('Driver reactivated successfully.', 'success');
            setShowReactivateModal(false);
            setSelectedDriver(null);
            fetchDrivers();
        } catch (err) {
            console.error('Failed to reactivate driver:', err);
            addToast('Failed to reactivate driver.', 'error');
        }
    }

    async function handleDeactivate() {
        if (!selectedDriver) return;
        try {
            await api.patch(`/roster/drivers/${selectedDriver.driver_id}/deactivate`);
            addToast('Driver deactivated and sessions revoked.', 'success');
            setShowDeactivateModal(false);
            setSelectedDriver(null);
            fetchDrivers();
        } catch (err) {
            console.error('Failed to deactivate driver:', err);
            addToast('Failed to deactivate driver.', 'error');
        }
    }

    const stats = {
        total: drivers?.length || 0,
        available: drivers?.filter(d => d.availability_status === 'available').length || 0,
        onTrip: drivers?.filter(d => d.current_trip_id).length || 0,
    };

    const gridCols = isMobile ? '1fr' : isTablet ? '1fr 1fr' : 'repeat(4, 1fr)';

    return (
        <>
            <style>{`
                @keyframes shimmer {
                    0% { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                @keyframes float-slow {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(-30px) rotate(8deg); }
                }
                @keyframes float-reverse {
                    0%, 100% { transform: translateY(0) rotate(0deg); }
                    50% { transform: translateY(20px) rotate(-6deg); }
                }
                .driver-card {
                    background: rgba(255,255,255,0.55);
                    backdrop-filter: blur(40px) saturate(180%);
                    -webkit-backdrop-filter: blur(40px) saturate(180%);
                    border: 1px solid rgba(255,255,255,0.7);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9);
                    border-radius: 2rem;
                    transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease;
                }
                .driver-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 16px 48px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.95);
                }
                .driver-card-modal:hover {
                    transform: none;
                    box-shadow: 0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9);
                }
                .table-row:hover {
                    background: rgba(255,255,255,0.8);
                }
                .driver-shimmer {
                    background: linear-gradient(90deg, rgba(255,255,255,0.4) 0%, rgba(255,255,255,0.8) 50%, rgba(255,255,255,0.4) 100%);
                    background-size: 200% 100%;
                    animation: shimmer 1.5s infinite linear;
                    border-radius: 2rem;
                    border: 1px solid rgba(255,255,255,0.5);
                }
                .geo-float-1 { animation: float-slow 11s ease-in-out infinite; }
                .geo-float-2 { animation: float-reverse 9s ease-in-out infinite; }
            `}</style>

            {/* Fixed background layer */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                <div style={{
                    position: 'absolute', inset: 0, opacity: 0.4,
                    backgroundImage: 'linear-gradient(rgba(0,0,0,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.06) 1px, transparent 1px)',
                    backgroundSize: '80px 80px'
                }} />
                <div className="geo-float-1" style={{ position: 'absolute', top: '15%', left: '3%', color: 'rgba(108,99,255,0.10)', pointerEvents: 'none' }}>
                    <div style={{ width: 0, height: 0, borderLeft: '100px solid transparent', borderRight: '100px solid transparent', borderBottom: '150px solid currentColor', transform: 'scale(2) rotate(12deg)' }} />
                </div>
                <div className="geo-float-2" style={{ position: 'absolute', bottom: '10%', right: '6%', color: 'rgba(108,99,255,0.08)', pointerEvents: 'none' }}>
                    <div style={{ width: 0, height: 0, borderLeft: '80px solid transparent', borderRight: '80px solid transparent', borderBottom: '120px solid currentColor', transform: 'scale(1.5) rotate(-15deg)' }} />
                </div>
            </div>

            {/* Page content */}
            <div style={{ position: 'relative', zIndex: 1, maxWidth: '1440px', margin: '0 auto', padding: isMobile ? '12px 16px 80px' : '16px 40px 80px', fontFamily: "'Be Vietnam Pro', sans-serif" }}>

                {/* LOADING STATE */}
                {loading && (
                    <div>
                        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '20px', marginBottom: '32px' }}>
                            {[...Array(4)].map((_, i) => (
                                <div key={i} className="driver-shimmer" style={{ height: '120px' }} />
                            ))}
                        </div>
                        <div className="driver-shimmer" style={{ height: '320px' }} />
                    </div>
                )}

                {/* ERROR STATE */}
                {!loading && error && (
                    <div className="driver-card" style={{ padding: '32px', borderLeft: '3px solid #E05A5A', maxWidth: '480px' }}>
                        <p style={{ fontSize: '14px', color: '#0D0D0D', marginBottom: '16px' }}>Failed to load driver roster. Check your connection.</p>
                        <button
                            onClick={() => { setError(false); fetchDrivers(); }}
                            style={{ background: '#6C63FF', color: 'white', border: 'none', borderRadius: '999px', padding: '8px 20px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* MAIN CONTENT */}
                {!loading && !error && (
                    <>
                        {/* Header */}
                        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                            <h1 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '32px', fontWeight: 900, letterSpacing: '-0.03em', color: '#0D0D0D' }}>
                                Driver Roster
                            </h1>
                            <button
                                onClick={() => setShowAddModal(true)}
                                style={{ background: '#6C63FF', color: 'white', border: 'none', borderRadius: '999px', padding: '10px 24px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                                Add Driver
                            </button>
                        </header>

                        {/* STAT TILES */}
                        <div style={{ display: 'grid', gridTemplateColumns: gridCols, gap: '20px', marginBottom: '32px' }}>
                            <div className="driver-card" style={{ padding: '24px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(108,99,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#6C63FF' }}>groups</span>
                                </div>
                                <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', fontWeight: 500, marginTop: '12px' }}>Total Drivers</p>
                                <p style={{ fontSize: '40px', fontWeight: 900, color: '#0D0D0D', letterSpacing: '-0.03em', lineHeight: 1, marginTop: '4px' }}>{stats.total}</p>
                            </div>
                            <div className="driver-card" style={{ padding: '24px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(0,245,160,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00A86B' }}>check_circle</span>
                                </div>
                                <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', fontWeight: 500, marginTop: '12px' }}>Available Now</p>
                                <p style={{ fontSize: '40px', fontWeight: 900, color: '#00A86B', letterSpacing: '-0.03em', lineHeight: 1, marginTop: '4px' }}>{stats.available}</p>
                            </div>
                            <div className="driver-card" style={{ padding: '24px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(0,212,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00D4FF' }}>directions_car</span>
                                </div>
                                <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', fontWeight: 500, marginTop: '12px' }}>On Trip</p>
                                <p style={{ fontSize: '40px', fontWeight: 900, color: '#00D4FF', letterSpacing: '-0.03em', lineHeight: 1, marginTop: '4px' }}>{stats.onTrip}</p>
                            </div>
                            <div className="driver-card" style={{ padding: '24px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'rgba(0,0,0,0.3)' }}>power_settings_new</span>
                                </div>
                                <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', fontWeight: 500, marginTop: '12px' }}>Offline</p>
                                <p style={{ fontSize: '40px', fontWeight: 900, color: 'rgba(0,0,0,0.4)', letterSpacing: '-0.03em', lineHeight: 1, marginTop: '4px' }}>
                                    {drivers.filter(d => d.availability_status === 'offline').length}
                                </p>
                            </div>
                        </div>

                        {/* DRIVERS TABLE */}
                        <div className="driver-card" style={{ overflow: 'hidden' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                            {['Name', 'Employee ID', 'Email', 'Status', 'Current Trip', 'Actions'].map(col => (
                                                <th key={col} style={{ padding: '12px 24px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {drivers.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} style={{ padding: '48px', textAlign: 'center' }}>
                                                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(0,0,0,0.3)' }}>No drivers added yet</p>
                                                </td>
                                            </tr>
                                        ) : drivers.map(d => {
                                            const avatarBg = d.availability_status === 'available'
                                                ? 'linear-gradient(135deg, #6C63FF, #8B85FF)'
                                                : d.availability_status === 'on_trip'
                                                ? 'linear-gradient(135deg, #00D4FF, #00F5A0)'
                                                : 'rgba(0,0,0,0.1)';
                                            const avatarColor = d.availability_status === 'on_trip' ? '#0D0D0D'
                                                : d.availability_status === 'available' ? 'white'
                                                : 'rgba(0,0,0,0.4)';
                                            const statusStyle = d.availability_status === 'available'
                                                ? { background: 'rgba(0,245,160,0.15)', color: '#00A86B', label: 'Available' }
                                                : d.availability_status === 'on_trip'
                                                ? { background: 'rgba(0,212,255,0.15)', color: '#0086A8', label: 'On Trip' }
                                                : { background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.4)', label: 'Offline' };

                                            return (
                                                <tr key={d.driver_id} className="table-row" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', transition: 'background 0.2s' }}>
                                                    <td style={{ padding: '14px 24px' }}>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: avatarBg, color: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 800, flexShrink: 0 }}>
                                                                {getInitials(d.full_name)}
                                                            </div>
                                                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#0D0D0D' }}>{d.full_name}</span>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '14px 24px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: 'rgba(0,0,0,0.5)' }}>
                                                        {d.employee_id}
                                                    </td>
                                                    <td style={{ padding: '14px 24px', fontSize: '13px', color: 'rgba(0,0,0,0.55)' }}>
                                                        {d.work_email}
                                                    </td>
                                                    <td style={{ padding: '14px 24px' }}>
                                                        <span style={{ borderRadius: '999px', padding: '4px 12px', fontSize: '11px', fontWeight: 700, background: statusStyle.background, color: statusStyle.color }}>
                                                            {statusStyle.label}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 24px', fontSize: '12px', fontFamily: 'JetBrains Mono, monospace', color: 'rgba(0,0,0,0.4)' }}>
                                                        {d.current_trip_id ? d.current_trip_id.slice(0, 8) + '...' : '—'}
                                                    </td>
                                                    <td style={{ padding: '14px 24px', textAlign: 'right' }}>
                                                        {d.active_status ? (
                                                            <button
                                                                onClick={() => { setSelectedDriver(d); setShowDeactivateModal(true); }}
                                                                style={{ fontSize: '13px', fontWeight: 600, color: '#E05A5A', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 12px', borderRadius: '999px', transition: 'background 0.2s', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(224,90,90,0.08)'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                                                            >
                                                                Deactivate
                                                            </button>
                                                        ) : (
                                                            <button
                                                                onClick={() => { setSelectedDriver(d); setShowReactivateModal(true); }}
                                                                style={{ fontSize: '13px', fontWeight: 600, color: '#00A86B', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 12px', borderRadius: '999px', transition: 'background 0.2s', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,168,107,0.08)'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                                                            >
                                                                Reactivate
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}

                {/* ADD DRIVER MODAL */}
                {showAddModal && (
                    <div
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                        onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}
                    >
                        <div className="driver-card driver-card-modal" style={{ padding: '40px', width: '100%', maxWidth: '440px', position: 'relative' }} onClick={e => e.stopPropagation()}>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                style={{ position: 'absolute', top: '24px', right: '24px', fontSize: '20px', color: 'rgba(0,0,0,0.4)', cursor: 'pointer', background: 'none', border: 'none', lineHeight: 1 }}
                            >
                                ×
                            </button>
                            <h2 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em', color: '#0D0D0D' }}>Add New Driver</h2>
                            <form onSubmit={handleAddDriver} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '24px' }}>
                                {[
                                    { label: 'Full Name', field: 'full_name', type: 'text' },
                                    { label: 'Work Email', field: 'work_email', type: 'email' },
                                    { label: 'Employee ID', field: 'employee_id', type: 'text' },
                                ].map(({ label, field, type }) => (
                                    <div key={field}>
                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(0,0,0,0.5)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            {label}
                                        </label>
                                        <input
                                            type={type}
                                            required
                                            value={newDriver[field]}
                                            onChange={e => setNewDriver({ ...newDriver, [field]: e.target.value })}
                                            style={{ width: '100%', background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '14px', padding: '12px 16px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: "'Be Vietnam Pro', sans-serif", transition: 'border-color 0.2s, box-shadow 0.2s' }}
                                            onFocus={e => { e.target.style.borderColor = 'rgba(108,99,255,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(108,99,255,0.1)'; }}
                                            onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
                                        />
                                    </div>
                                ))}
                                {formError && <p style={{ fontSize: '12px', color: '#E05A5A', margin: 0 }}>{formError}</p>}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                                    <button
                                        type="button"
                                        onClick={() => setShowAddModal(false)}
                                        style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.6)', borderRadius: '999px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        style={{ background: '#6C63FF', color: 'white', borderRadius: '999px', padding: '10px 24px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                    >
                                        Add Driver
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* DEACTIVATE MODAL */}
                {showDeactivateModal && selectedDriver && (
                    <div
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                        onClick={e => { if (e.target === e.currentTarget) { setShowDeactivateModal(false); setSelectedDriver(null); } }}
                    >
                        <div className="driver-card driver-card-modal" style={{ padding: '32px', width: '100%', maxWidth: '380px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(224,90,90,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#E05A5A' }}>warning</span>
                            </div>
                            <h2 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '18px', fontWeight: 900, letterSpacing: '-0.02em', color: '#0D0D0D' }}>Deactivate Driver?</h2>
                            <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', marginTop: '8px', marginBottom: '24px', lineHeight: 1.6 }}>
                                This will immediately revoke <strong>{selectedDriver.full_name}</strong>&apos;s access and blocklist their active session.
                            </p>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                <button
                                    onClick={() => { setShowDeactivateModal(false); setSelectedDriver(null); }}
                                    style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.6)', borderRadius: '999px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDeactivate}
                                    style={{ background: '#E05A5A', color: 'white', borderRadius: '999px', padding: '10px 24px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                >
                                    Deactivate
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* REACTIVATE MODAL */}
                {showReactivateModal && selectedDriver && (
                    <div
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                        onClick={e => { if (e.target === e.currentTarget) { setShowReactivateModal(false); setSelectedDriver(null); } }}
                    >
                        <div className="driver-card driver-card-modal" style={{ padding: '32px', width: '100%', maxWidth: '380px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(0,168,107,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#00A86B' }}>check_circle</span>
                            </div>
                            <h2 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '18px', fontWeight: 900, letterSpacing: '-0.02em', color: '#0D0D0D' }}>Reactivate Driver?</h2>
                            <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', marginTop: '8px', marginBottom: '24px', lineHeight: 1.6 }}>
                                <strong>{selectedDriver.full_name}</strong> will be restored to active status and marked as available.
                            </p>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                <button
                                    onClick={() => { setShowReactivateModal(false); setSelectedDriver(null); }}
                                    style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.6)', borderRadius: '999px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReactivate}
                                    style={{ background: '#00A86B', color: 'white', borderRadius: '999px', padding: '10px 24px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                >
                                    Reactivate
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </>
    );
}
