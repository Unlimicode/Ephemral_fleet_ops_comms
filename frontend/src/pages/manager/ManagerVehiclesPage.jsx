import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import ManagerLayout from '../../components/layout/ManagerLayout.jsx';
import GlassCard from '../../components/layout/GlassCard.jsx';
import PageWrapper from '../../components/layout/PageWrapper.jsx';
import { useToast } from '../../components/Toast.jsx';

export default function ManagerVehiclesPage() {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [newVehicle, setNewVehicle] = useState({ registration_number: '', type: 'Sedan', capacity: 4 });
    const [formError, setFormError] = useState('');
    const { addToast } = useToast();

    const fetchVehicles = useCallback(async () => {
        try {
            const res = await axios.get('/api/vehicles');
            setVehicles(res.data);
            setLoading(false);
        } catch (err) {
            console.error('Failed to fetch vehicles:', err);
            addToast('error', 'Could not load vehicle inventory.');
        }
    }, [addToast]);

    useEffect(() => {
        const deferredFetch = async () => await fetchVehicles();
        deferredFetch();
    }, [fetchVehicles]);

    async function handleAddVehicle(e) {
        e.preventDefault();
        setFormError('');
        try {
            await axios.post('/api/vehicles', newVehicle);
            addToast('success', 'Vehicle added successfully.');
            setShowAddModal(false);
            setNewVehicle({ registration_number: '', type: 'Sedan', capacity: 4 });
            fetchVehicles();
        } catch (err) {
            setFormError(err.response?.data?.error || 'Failed to add vehicle.');
        }
    }

    async function handleDelete() {
        if (!selectedVehicle) return;
        try {
            await axios.delete(`/api/vehicles/${selectedVehicle.vehicle_id}`);
            addToast('success', 'Vehicle removed from inventory.');
            setShowDeleteModal(false);
            setSelectedVehicle(null);
            fetchVehicles();
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to remove vehicle.';
            addToast('error', msg);
            setShowDeleteModal(false);
        }
    }

    const stats = {
        total: vehicles.length,
        deployed: vehicles.filter(v => v.deployment_status === 'deployed').length,
        available: vehicles.filter(v => v.deployment_status === 'available').length,
    };

    return (
        <ManagerLayout>
            <PageWrapper>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0D0D0D' }}>Vehicle Inventory</h1>
                    <button
                        onClick={() => setShowAddModal(true)}
                        style={btnBlackStyle}
                        onMouseEnter={e => e.currentTarget.style.opacity = 0.8}
                        onMouseLeave={e => e.currentTarget.style.opacity = 1}
                    >
                        + Add Vehicle
                    </button>
                </div>

                {/* Stats Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                    <StatCard label="Total Vehicles" value={stats.total} />
                    <StatCard label="Deployed" value={stats.deployed} color="#3B82F6" />
                    <StatCard label="Available" value={stats.available} color="#10B981" />
                </div>

                {/* Vehicle Grid */}
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '100px', opacity: 0.5 }}>Loading inventory...</div>
                ) : (
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '24px'
                    }}>
                        {vehicles.map(vehicle => (
                            <VehicleCard
                                key={vehicle.vehicle_id}
                                vehicle={vehicle}
                                onRemove={() => { setSelectedVehicle(vehicle); setShowDeleteModal(true); }}
                            />
                        ))}
                    </div>
                )}

                {/* Add Vehicle Modal */}
                {showAddModal && (
                    <Modal onClose={() => setShowAddModal(false)} title="Add New Vehicle">
                        <form onSubmit={handleAddVehicle} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <Input label="Registration Number" required value={newVehicle.registration_number} onChange={v => setNewVehicle({ ...newVehicle, registration_number: v })} />

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 600, color: '#4B5563' }}>Type</label>
                                <select
                                    value={newVehicle.type}
                                    onChange={e => setNewVehicle({ ...newVehicle, type: e.target.value })}
                                    style={inputStyle}
                                >
                                    <option>Sedan</option>
                                    <option>SUV</option>
                                    <option>Van</option>
                                    <option>Bus</option>
                                </select>
                            </div>

                            <Input label="Capacity (Passengers)" type="number" required value={newVehicle.capacity} onChange={v => setNewVehicle({ ...newVehicle, capacity: parseInt(v) })} />

                            {formError && <p style={{ color: '#EF4444', fontSize: '13px' }}>{formError}</p>}

                            <button type="submit" style={btnPrimaryStyle}>Add to Fleet</button>
                        </form>
                    </Modal>
                )}

                {/* Remove Confirmation Modal */}
                {showDeleteModal && (
                    <Modal onClose={() => setShowDeleteModal(false)} title="Remove Vehicle">
                        <p style={{ fontSize: '14px', marginBottom: '24px', lineHeight: '1.5' }}>
                            Are you sure you want to remove <strong>{selectedVehicle.registration_number}</strong>? This action cannot be undone.
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={handleDelete} style={{ ...btnPrimaryStyle, background: '#EF4444', flex: 1 }}>Remove Vehicle</button>
                            <button onClick={() => setShowDeleteModal(false)} style={{ ...btnSecondaryStyle, flex: 1 }}>Cancel</button>
                        </div>
                    </Modal>
                )}
            </PageWrapper>
        </ManagerLayout>
    );
}

function VehicleCard({ vehicle, onRemove }) {
    return (
        <GlassCard style={{ padding: '24px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div style={{
                    fontFamily: 'monospace',
                    fontSize: '20px',
                    fontWeight: 800,
                    color: '#0D0D0D',
                    letterSpacing: '1px'
                }}>
                    {vehicle.registration_number}
                </div>
                <span style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    background: 'rgba(0,0,0,0.05)',
                    color: '#6B6B6B'
                }}>
                    {vehicle.type}
                </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                <div style={detailRow}>
                    <span style={detailLabel}>Capacity</span>
                    <span style={detailValue}>{vehicle.capacity} passengers</span>
                </div>
                <div style={detailRow}>
                    <span style={detailLabel}>Status</span>
                    <StatusBadge status={vehicle.deployment_status} />
                </div>
                {vehicle.deployment_status === 'deployed' && (
                    <div style={detailRow}>
                        <span style={detailLabel}>Driver</span>
                        <span style={detailValue}>{vehicle.assigned_driver_name || 'Assigned'}</span>
                    </div>
                )}
            </div>

            <button
                onClick={onRemove}
                style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '10px',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    background: 'rgba(239, 68, 68, 0.05)',
                    color: '#EF4444',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'}
            >
                Remove Vehicle
            </button>
        </GlassCard>
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
    const isAvailable = status === 'available';
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '4px 12px', borderRadius: '50px',
            fontSize: '11px', fontWeight: 700,
            background: isAvailable ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
            color: isAvailable ? '#10B981' : '#3B82F6',
            textTransform: 'uppercase'
        }}>
            <span style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: isAvailable ? '#10B981' : '#3B82F6'
            }} />
            {status}
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
                style={inputStyle}
                onChange={e => props.onChange(e.target.value)}
                {...props}
            />
        </div>
    );
}

const inputStyle = { padding: '12px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)', fontSize: '14px' };
const btnBlackStyle = { padding: '12px 24px', background: 'rgba(13,13,13,0.9)', color: '#FFF', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(10px)', transition: 'opacity 0.2s' };
const btnPrimaryStyle = { padding: '14px', background: '#0D0D0D', color: '#FFF', border: 'none', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' };
const btnSecondaryStyle = { padding: '14px', background: 'transparent', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', fontWeight: 600, cursor: 'pointer' };
const detailRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const detailLabel = { fontSize: '13px', color: '#6B6B6B' };
const detailValue = { fontSize: '13px', fontWeight: 600, color: '#111827' };
