import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import pool from '../config/db.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST / - Assign a new Physical Vehicle 
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', requireAuth(['fleet_manager']), async (req, res) => {
    const { registration_number, type, capacity } = req.body;
    const fleetManagerId = req.user.id;

    if (!registration_number || !type || capacity === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!Number.isInteger(capacity) || capacity <= 0) {
        return res.status(400).json({ error: 'Capacity must be a positive integer.' });
    }

    try {
        const duplicateCheck = await pool.query('SELECT id FROM vehicles WHERE registration_number = $1', [registration_number]);
        if (duplicateCheck.rows.length > 0) {
            return res.status(409).json({ error: 'Vehicle registration already exists.' });
        }

        const insertResult = await pool.query(
            `INSERT INTO vehicles (registration_number, type, capacity)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [registration_number, type, capacity]
        );

        const newVehicleId = insertResult.rows[0].id;

        await pool.query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['VEHICLE_ADDED', fleetManagerId, 'fleet_manager', newVehicleId, { registration_number, type, capacity }]
        );

        return res.status(201).json(insertResult.rows[0]);

    } catch (err) {
        console.error('[vehicles] POST / error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /:vehicleId - Safely retire a Physical Vehicle enforcing Deployment locks.
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:vehicleId', requireAuth(['fleet_manager']), async (req, res) => {
    const { vehicleId } = req.params;
    const fleetManagerId = req.user.id;

    try {
        const vehicleCheck = await pool.query('SELECT registration_number FROM vehicles WHERE id = $1', [vehicleId]);
        if (vehicleCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }

        const registration_number = vehicleCheck.rows[0].registration_number;

        // Native Architecture Lock: Cannot scrap vehicles that are physically deployed.
        const deploymentCheck = await pool.query(
            "SELECT id FROM trips WHERE vehicle_id = $1 AND status = 'in_progress'",
            [vehicleId]
        );

        if (deploymentCheck.rows.length > 0) {
            return res.status(409).json({ error: 'Vehicle is currently deployed' });
        }

        await pool.query('DELETE FROM vehicles WHERE id = $1', [vehicleId]);

        await pool.query(
            `INSERT INTO audit_log (action_type, actor_id, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            ['VEHICLE_REMOVED', fleetManagerId, 'fleet_manager', vehicleId, { vehicle_id: vehicleId, registration_number }]
        );

        return res.status(200).json({ message: 'Vehicle removed.' });

    } catch (err) {
        console.error('[vehicles] DELETE /:vehicleId error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET / - Read Vehicle Inventory with Dynamic Deployment Statuses natively.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', requireAuth(['fleet_manager']), async (req, res) => {
    try {
        const query = `
            SELECT 
                v.id AS vehicle_id, 
                v.registration_number, 
                v.type, 
                v.capacity,
                CASE 
                    WHEN COUNT(t.id) > 0 THEN 'deployed'
                    ELSE 'available'
                END as deployment_status,
                MAX(d.full_name) as assigned_driver_name
            FROM vehicles v
            LEFT JOIN trips t ON v.id = t.vehicle_id AND t.status = 'in_progress'
            LEFT JOIN drivers d ON t.assigned_driver_id = d.id
            GROUP BY v.id
            ORDER BY v.registration_number ASC
        `;

        const result = await pool.query(query);
        return res.status(200).json(result.rows);

    } catch (err) {
        console.error('[vehicles] GET / error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
