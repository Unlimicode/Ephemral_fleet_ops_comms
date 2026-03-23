import { useState, useEffect, useCallback } from 'react';
import api from '../../api/axios.js';
import { useToast } from '../../components/Toast.jsx';
import useWindowWidth from '../../hooks/useWindowWidth.js';

export default function ManagerVehiclesPage() {
    const [vehicles, setVehicles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [newVehicle, setNewVehicle] = useState({ registration_number: '', type: 'Sedan', capacity: 4 });
    const [formError, setFormError] = useState('');
    const { addToast } = useToast();
    const width = useWindowWidth();
    const isMobile = width < 768;

    const fetchVehicles = useCallback(async () => {
        try {
            const res = await api.get('/vehicles');
            setVehicles(Array.isArray(res.data) ? res.data : []);
            setError(false);
        } catch (err) {
            console.error('Failed to fetch vehicles:', err);
            setError(true);
            addToast('Could not load vehicle inventory.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchVehicles();
    }, [fetchVehicles]);

    async function handleAddVehicle(e) {
        e.preventDefault();
        setFormError('');
        try {
            await api.post('/vehicles', newVehicle);
            addToast('Vehicle added successfully.', 'success');
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
            await api.delete(`/vehicles/${selectedVehicle.vehicle_id}`);
            addToast('Vehicle removed from inventory.', 'success');
            setShowDeleteModal(false);
            setSelectedVehicle(null);
            fetchVehicles();
        } catch (err) {
            const msg = err.response?.data?.error || 'Failed to remove vehicle.';
            addToast(msg, 'error');
            setShowDeleteModal(false);
        }
    }

    const stats = {
        total: vehicles?.length || 0,
        deployed: vehicles?.filter(v => v.deployment_status === 'deployed').length || 0,
        available: vehicles?.filter(v => v.deployment_status === 'available').length || 0,
    };

    const statCols = isMobile ? '1fr' : 'repeat(3, 1fr)';
    const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'rgba(0,0,0,0.5)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' };
    const inputBase = { width: '100%', background: 'rgba(255,255,255,0.6)', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '14px', padding: '12px 16px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', fontFamily: "'Be Vietnam Pro', sans-serif", transition: 'border-color 0.2s, box-shadow 0.2s' };

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
                .vehicle-card {
                    background: rgba(255,255,255,0.55);
                    backdrop-filter: blur(40px) saturate(180%);
                    -webkit-backdrop-filter: blur(40px) saturate(180%);
                    border: 1px solid rgba(255,255,255,0.7);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9);
                    border-radius: 2rem;
                    transition: transform 0.3s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.3s ease;
                }
                .vehicle-card:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 16px 48px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.95);
                }
                .vehicle-card-modal {
                    background: rgba(255,255,255,0.55);
                    backdrop-filter: blur(40px) saturate(180%);
                    -webkit-backdrop-filter: blur(40px) saturate(180%);
                    border: 1px solid rgba(255,255,255,0.7);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.9);
                    border-radius: 2rem;
                }
                .table-row:hover { background: rgba(255,255,255,0.5); }
                .vehicle-shimmer {
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
                        <div style={{ display: 'grid', gridTemplateColumns: statCols, gap: '20px', marginBottom: '32px' }}>
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="vehicle-shimmer" style={{ height: '120px' }} />
                            ))}
                        </div>
                        <div className="vehicle-shimmer" style={{ height: '320px' }} />
                    </div>
                )}

                {/* ERROR STATE */}
                {!loading && error && (
                    <div className="vehicle-card" style={{ padding: '32px', borderLeft: '3px solid #E05A5A', maxWidth: '480px' }}>
                        <p style={{ fontSize: '14px', color: '#0D0D0D', marginBottom: '16px' }}>Failed to load vehicle inventory. Check your connection.</p>
                        <button
                            onClick={() => { setError(false); fetchVehicles(); }}
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
                            <h1 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '32px', fontWeight: 900, letterSpacing: '-0.03em', color: '#0D0D0D', textTransform: 'uppercase' }}>
                                Vehicle Inventory
                            </h1>
                            <button
                                onClick={() => setShowAddModal(true)}
                                style={{ background: '#6C63FF', color: 'white', border: 'none', borderRadius: '999px', padding: '10px 24px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                            >
                                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                                Add Vehicle
                            </button>
                        </header>

                        {/* STAT TILES */}
                        <div style={{ display: 'grid', gridTemplateColumns: statCols, gap: '20px', marginBottom: '32px' }}>
                            <div className="vehicle-card" style={{ padding: '24px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(108,99,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#6C63FF' }}>local_shipping</span>
                                </div>
                                <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', fontWeight: 500, marginTop: '12px' }}>Total Vehicles</p>
                                <p style={{ fontSize: '40px', fontWeight: 900, color: '#0D0D0D', letterSpacing: '-0.03em', lineHeight: 1, marginTop: '4px' }}>{stats.total}</p>
                            </div>
                            <div className="vehicle-card" style={{ padding: '24px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(0,245,160,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00D188' }}>check_circle</span>
                                </div>
                                <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', fontWeight: 500, marginTop: '12px' }}>Available</p>
                                <p style={{ fontSize: '40px', fontWeight: 900, color: '#00D188', letterSpacing: '-0.03em', lineHeight: 1, marginTop: '4px' }}>{stats.available}</p>
                            </div>
                            <div className="vehicle-card" style={{ padding: '24px' }}>
                                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(0,212,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: '20px', color: '#00B4FF' }}>sensors</span>
                                </div>
                                <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', fontWeight: 500, marginTop: '12px' }}>Deployed</p>
                                <p style={{ fontSize: '40px', fontWeight: 900, color: '#00B4FF', letterSpacing: '-0.03em', lineHeight: 1, marginTop: '4px' }}>{stats.deployed}</p>
                            </div>
                        </div>

                        {/* VEHICLES TABLE */}
                        <div className="vehicle-card" style={{ overflow: 'hidden' }}>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                                            {['Registration', 'Vehicle Details', 'Status', 'Assigned Driver', 'Actions'].map(col => (
                                                <th key={col} style={{ padding: '12px 32px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(0,0,0,0.4)', textAlign: 'left', whiteSpace: 'nowrap' }}>
                                                    {col}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {vehicles.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} style={{ padding: '48px', textAlign: 'center' }}>
                                                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(0,0,0,0.3)' }}>No vehicles in inventory</p>
                                                </td>
                                            </tr>
                                        ) : vehicles.map(v => {
                                            const isDeployed = v.deployment_status === 'deployed';
                                            return (
                                                <tr key={v.vehicle_id} className="table-row" style={{ borderBottom: '1px solid rgba(0,0,0,0.04)', transition: 'background 0.2s' }}>
                                                    <td style={{ padding: '16px 32px' }}>
                                                        <span style={{ fontSize: '18px', fontWeight: 900, letterSpacing: '-0.02em', color: '#0D0D0D', fontFamily: 'JetBrains Mono, monospace' }}>
                                                            {v.registration_number}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '16px 32px' }}>
                                                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#0D0D0D' }}>{v.type}</p>
                                                        <p style={{ fontSize: '10px', color: 'rgba(0,0,0,0.45)', marginTop: '2px' }}>{v.capacity} Passengers</p>
                                                    </td>
                                                    <td style={{ padding: '16px 32px' }}>
                                                        <span style={{
                                                            borderRadius: '999px', padding: '4px 12px',
                                                            fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                                                            background: isDeployed ? 'rgba(0,212,255,0.1)' : 'rgba(0,245,160,0.1)',
                                                            color: isDeployed ? '#00B4FF' : '#00D188',
                                                        }}>
                                                            {isDeployed ? 'Deployed' : 'Available'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '16px 32px' }}>
                                                        {v.assigned_driver_name
                                                            ? <span style={{ fontSize: '13px', fontWeight: 700, color: '#0D0D0D' }}>{v.assigned_driver_name}</span>
                                                            : <span style={{ fontSize: '13px', color: 'rgba(0,0,0,0.35)', fontStyle: 'italic' }}>Unassigned</span>
                                                        }
                                                    </td>
                                                    <td style={{ padding: '16px 32px', textAlign: 'right' }}>
                                                        {isDeployed ? (
                                                            <span className="material-symbols-outlined" style={{ fontSize: '20px', color: 'rgba(0,0,0,0.3)', verticalAlign: 'middle' }}>more_horiz</span>
                                                        ) : (
                                                            <button
                                                                onClick={() => { setSelectedVehicle(v); setShowDeleteModal(true); }}
                                                                style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#E05A5A', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 12px', borderRadius: '999px', transition: 'background 0.2s', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(224,90,90,0.08)'; }}
                                                                onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                                                            >
                                                                Remove
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

                {/* ADD VEHICLE MODAL */}
                {showAddModal && (
                    <div
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                        onClick={e => { if (e.target === e.currentTarget) setShowAddModal(false); }}
                    >
                        <div className="vehicle-card-modal" style={{ padding: '40px', width: '100%', maxWidth: '440px', position: 'relative' }} onClick={e => e.stopPropagation()}>
                            <button
                                type="button"
                                onClick={() => setShowAddModal(false)}
                                style={{ position: 'absolute', top: '24px', right: '24px', fontSize: '20px', color: 'rgba(0,0,0,0.4)', cursor: 'pointer', background: 'none', border: 'none', lineHeight: 1 }}
                            >
                                ×
                            </button>
                            <h2 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em', color: '#0D0D0D' }}>Add Vehicle</h2>
                            <form onSubmit={handleAddVehicle} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '24px' }}>
                                <div>
                                    <label style={labelStyle}>Registration Number</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. KDA 001A"
                                        value={newVehicle.registration_number}
                                        onChange={e => setNewVehicle({ ...newVehicle, registration_number: e.target.value })}
                                        style={inputBase}
                                        onFocus={e => { e.target.style.borderColor = 'rgba(108,99,255,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(108,99,255,0.1)'; }}
                                        onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
                                    />
                                </div>
                                <div>
                                    <label style={labelStyle}>Vehicle Type</label>
                                    <select
                                        value={newVehicle.type}
                                        onChange={e => setNewVehicle({ ...newVehicle, type: e.target.value })}
                                        style={inputBase}
                                        onFocus={e => { e.target.style.borderColor = 'rgba(108,99,255,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(108,99,255,0.1)'; }}
                                        onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
                                    >
                                        <option>Sedan</option>
                                        <option>SUV</option>
                                        <option>Van</option>
                                        <option>Bus</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={labelStyle}>Capacity</label>
                                    <input
                                        type="number"
                                        required
                                        min={1}
                                        max={60}
                                        value={newVehicle.capacity}
                                        onChange={e => setNewVehicle({ ...newVehicle, capacity: parseInt(e.target.value) || 1 })}
                                        style={inputBase}
                                        onFocus={e => { e.target.style.borderColor = 'rgba(108,99,255,0.5)'; e.target.style.boxShadow = '0 0 0 3px rgba(108,99,255,0.1)'; }}
                                        onBlur={e => { e.target.style.borderColor = 'rgba(0,0,0,0.1)'; e.target.style.boxShadow = 'none'; }}
                                    />
                                </div>
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
                                        Add Vehicle
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* DELETE MODAL */}
                {showDeleteModal && selectedVehicle && (
                    <div
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                        onClick={e => { if (e.target === e.currentTarget) { setShowDeleteModal(false); setSelectedVehicle(null); } }}
                    >
                        <div className="vehicle-card-modal" style={{ padding: '32px', width: '100%', maxWidth: '380px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                            <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(224,90,90,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: '28px', color: '#E05A5A' }}>warning</span>
                            </div>
                            <h2 style={{ fontFamily: "'Be Vietnam Pro', sans-serif", fontSize: '18px', fontWeight: 900, letterSpacing: '-0.02em', color: '#0D0D0D' }}>Remove Vehicle?</h2>
                            <p style={{ fontSize: '13px', color: 'rgba(0,0,0,0.5)', marginTop: '8px', marginBottom: '24px', lineHeight: 1.6 }}>
                                Remove <strong>{selectedVehicle.registration_number}</strong> from the fleet inventory? This cannot be undone.
                            </p>
                            {selectedVehicle.deployment_status === 'deployed' && (
                                <p style={{ fontSize: '12px', fontWeight: 600, color: '#F59E0B', marginBottom: '16px' }}>
                                    This vehicle is currently deployed and cannot be removed.
                                </p>
                            )}
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                                <button
                                    onClick={() => { setShowDeleteModal(false); setSelectedVehicle(null); }}
                                    style={{ background: 'rgba(0,0,0,0.06)', color: 'rgba(0,0,0,0.6)', borderRadius: '999px', padding: '10px 20px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={selectedVehicle.deployment_status === 'deployed'}
                                    style={{ background: '#E05A5A', color: 'white', borderRadius: '999px', padding: '10px 24px', fontSize: '13px', fontWeight: 700, border: 'none', cursor: selectedVehicle.deployment_status === 'deployed' ? 'not-allowed' : 'pointer', opacity: selectedVehicle.deployment_status === 'deployed' ? 0.5 : 1, fontFamily: "'Be Vietnam Pro', sans-serif" }}
                                >
                                    Remove
                                </button>
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </>
    );
}
