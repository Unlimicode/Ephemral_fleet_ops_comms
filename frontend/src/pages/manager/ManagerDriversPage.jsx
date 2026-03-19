import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios.js';
import ManagerLayout from '../../components/layout/ManagerLayout.jsx';
import GlassCard from '../../components/layout/GlassCard.jsx';
import PageWrapper from '../../components/layout/PageWrapper.jsx';
import { useToast } from '../../components/Toast.jsx';
import StatCard from '../../components/StatCard.jsx';

export default function ManagerDriversPage() {
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [newDriver, setNewDriver] = useState({ full_name: '', work_email: '', password: '', employee_id: '' });
    const [formError, setFormError] = useState('');
    const { addToast } = useToast();

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

    if (error && drivers.length === 0) {
        return (
            <PageWrapper>
                <div style={{ textAlign: 'center', padding: '100px' }}>
                    <h2 style={{ color: '#EF4444' }}>Failed to load drivers</h2>
                    <button onClick={fetchDrivers} style={btnPrimaryStyle}>Retry</button>
                </div>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h1 className="kinetic-text reveal-up" style={{ fontSize: '24px', fontWeight: 800, color: '#0D0D0D' }}>Driver Roster</h1>
                <button
                    onClick={() => setShowAddModal(true)}
                    style={{
                        padding: '12px 24px',
                        background: 'rgba(13,13,13,0.9)',
                        color: '#FFF',
                        border: 'none',
                        borderRadius: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        backdropFilter: 'blur(10px)',
                        transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
                    onMouseLeave={e => e.currentTarget.style.opacity = 1}
                >
                    + Add Driver
                </button>
            </div>

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                <StatCard title="Total Drivers" value={stats.total} icon="👥" tint="blue" />
                <StatCard title="Available Now" value={stats.available} icon="✅" tint="green" />
                <StatCard title="On Trip" value={stats.onTrip} icon="🚗" tint="amber" pulse={stats.onTrip > 0} />
            </div>

            {/* Driver Table */}
            <GlassCard style={{ padding: '0', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ background: 'rgba(0,0,0,0.03)', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                                <th style={thStyle}>Name</th>
                                <th style={thStyle}>Employee ID</th>
                                <th style={thStyle}>Email</th>
                                <th style={thStyle}>Status</th>
                                <th style={thStyle}>Current Trip</th>
                                <th style={thStyle}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center' }}>
                                    <div className="spinner" style={{ margin: '0 auto 12px' }} />
                                    <span style={{ opacity: 0.5 }}>Loading roster...</span>
                                </td></tr>
                            ) : drivers.length === 0 ? (
                                <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', opacity: 0.5 }}>No drivers found.</td></tr>
                            ) : drivers.map(driver => (
                                <tr key={driver.driver_id} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)' }}>
                                    <td style={tdStyle}>{driver.full_name}</td>
                                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{driver.employee_id}</td>
                                    <td style={tdStyle}>{driver.work_email}</td>
                                    <td style={tdStyle}>
                                        <StatusBadge status={driver.availability_status} />
                                    </td>
                                    <td style={{ ...tdStyle, fontFamily: 'monospace' }}>{driver.current_trip_id || '—'}</td>
                                    <td style={tdStyle}>
                                        {driver.active_status ? (
                                            <button
                                                onClick={() => { setSelectedDriver(driver); setShowDeactivateModal(true); }}
                                                style={{ color: '#EF4444', background: 'transparent', border: 'none', fontWeight: 600, cursor: 'pointer', fontSize: '13px' }}
                                            >
                                                Deactivate
                                            </button>
                                        ) : (
                                            <span style={{ fontSize: '13px', opacity: 0.5 }}>Inactive</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </GlassCard>

            {/* Add Driver Modal */}
            {showAddModal && (
                <Modal onClose={() => setShowAddModal(false)} title="Add New Driver">
                    <form onSubmit={handleAddDriver} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <Input label="Full Name" required value={newDriver.full_name} onChange={v => setNewDriver({ ...newDriver, full_name: v })} />
                        <Input label="Work Email" type="email" required value={newDriver.work_email} onChange={v => setNewDriver({ ...newDriver, work_email: v })} />
                        <Input label="Password" type="password" required value={newDriver.password} onChange={v => setNewDriver({ ...newDriver, password: v })} />
                        <Input label="Employee ID" required value={newDriver.employee_id} onChange={v => setNewDriver({ ...newDriver, employee_id: v })} />

                        {formError && <p style={{ color: '#EF4444', fontSize: '13px' }}>{formError}</p>}

                        <button type="submit" style={btnPrimaryStyle}>Create Account</button>
                    </form>
                </Modal>
            )}

            {/* Deactivate Confirmation Modal */}
            {showDeactivateModal && (
                <Modal onClose={() => setShowDeactivateModal(false)} title="Confirm Deactivation">
                    <p style={{ fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
                        This will immediately revoke this driver's session and access. Are you sure?
                    </p>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <button onClick={handleDeactivate} style={{ ...btnPrimaryStyle, background: '#EF4444', flex: 1 }}>Confirm Deactivation</button>
                        <button onClick={() => setShowDeactivateModal(false)} style={{ ...btnSecondaryStyle, flex: 1 }}>Cancel</button>
                    </div>
                </Modal>
            )}
        </PageWrapper>
    );
}


function StatusBadge({ status }) {
    const config = {
        available: { label: 'Available', color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
        on_trip: { label: 'On Trip', color: '#3B82F6', bg: 'rgba(59,130,246,0.1)', pulse: true },
        offline: { label: 'Offline', color: '#6B6B6B', bg: 'rgba(107,114,128,0.1)' }
    };
    const c = config[status] || config.offline;
    return (
        <span style={{
            display: 'inline-block', alignItems: 'center', gap: '6px',
            padding: '2px 8px', borderRadius: '50px',
            fontSize: '12px', fontWeight: 600,
            background: c.bg, color: c.color,
            animation: c.pulse ? 'pulseRing 2s infinite' : 'none'
        }}>
            {c.pulse && <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: c.color }} />}
            {c.label}
            <style>{`
                @keyframes pulseRing {
                    0% { box-shadow: 0 0 0 0 rgba(59,130,246,0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(59,130,246,0); }
                    100% { box-shadow: 0 0 0 0 rgba(59,130,246,0); }
                }
            `}</style>
        </span>
    );
}

function Modal({ children, onClose, title }) {
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
            <GlassCard style={{ width: '100%', maxWidth: '450px', position: 'relative', padding: '32px', border: '1px solid rgba(255,255,255,0.2)' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '24px' }}>{title}</h2>
                {children}
            </GlassCard>
        </div>
    );
}

function Input({ label, type = 'text', ...props }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#4B5563' }}>{label}</label>
            <input
                type={type}
                style={{
                    padding: '12px', borderRadius: '10px',
                    border: '1px solid rgba(0,0,0,0.1)',
                    background: 'rgba(255,255,255,0.5)',
                    fontSize: '14px'
                }}
                onChange={e => props.onChange(e.target.value)}
                {...props}
            />
        </div>
    );
}

const thStyle = { padding: '16px', fontSize: '13px', fontWeight: 600, color: '#6B6B6B' };
const tdStyle = { padding: '16px', fontSize: '14px', color: '#111827' };
const btnPrimaryStyle = { padding: '14px', background: '#0D0D0D', color: '#FFF', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' };
const btnSecondaryStyle = { padding: '14px', background: 'transparent', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' };
