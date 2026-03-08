import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import ManagerLayout from '../../components/layout/ManagerLayout.jsx';
import GlassCard from '../../components/layout/GlassCard.jsx';
import PageWrapper from '../../components/layout/PageWrapper.jsx';
import { useToast } from '../../components/Toast.jsx';

export default function ManagerDriversPage() {
    const [drivers, setDrivers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [selectedDriver, setSelectedDriver] = useState(null);
    const [newDriver, setNewDriver] = useState({ full_name: '', work_email: '', password: '', employee_id: '' });
    const [formError, setFormError] = useState('');
    const { addToast } = useToast();

    const fetchDrivers = useCallback(async () => {
        try {
            const res = await axios.get('/api/roster/drivers');
            setDrivers(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch drivers:', err);
            addToast('error', 'Could not load driver roster.');
        }
    }, [addToast]);

    useEffect(() => {
        const deferredFetch = async () => await fetchDrivers();
        deferredFetch();
        const interval = setInterval(fetchDrivers, 30000);
        return () => clearInterval(interval);
    }, [fetchDrivers]);

    async function handleAddDriver(e) {
        e.preventDefault();
        setFormError('');
        try {
            await axios.post('/api/roster/drivers', newDriver);
            addToast('success', 'Driver added successfully.');
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
            await axios.patch(`/api/roster/drivers/${selectedDriver.driver_id}/deactivate`);
            addToast('success', 'Driver deactivated and sessions revoked.');
            setShowDeactivateModal(false);
            setSelectedDriver(null);
            fetchDrivers();
        } catch (err) {
            console.error('Failed to deactivate driver:', err);
            addToast('error', 'Failed to deactivate driver.');
        }
    }

    const stats = {
        total: drivers.length,
        available: drivers.filter(d => d.availability_status === 'available').length,
        onTrip: drivers.filter(d => d.availability_status === 'on_trip').length,
    };

    return (
        <ManagerLayout>
            <PageWrapper>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0D0D0D' }}>Driver Roster</h1>
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
                    <StatCard label="Total Drivers" value={stats.total} />
                    <StatCard label="Available Now" value={stats.available} color="#10B981" />
                    <StatCard label="On Trip" value={stats.onTrip} color="#3B82F6" />
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
                                    <tr><td colSpan="6" style={{ padding: '40px', textAlign: 'center', opacity: 0.5 }}>Loading roster...</td></tr>
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
        </ManagerLayout>
    );
}

function StatCard({ label, value, color = '#0D0D0D' }) {
    return (
        <GlassCard style={{ padding: '24px' }}>
            <p style={{ fontSize: '13px', color: '#6B6B6B', marginBottom: '8px', fontWeight: 500 }}>{label}</p>
            <p style={{ fontSize: '32px', fontWeight: 800, color }}>{value}</p>
        </GlassCard>
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
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '4px 12px', borderRadius: '50px',
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
