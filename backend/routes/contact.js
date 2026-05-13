import { Router } from 'express';
import { query } from '../config/db.js';
import { sendContactEnquiry } from '../config/mailer.js';
import { emitDashboardEvent } from '../socket/dashboardNamespace.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// POST /api/contact — public, saves enquiry + notifies manager
router.post('/', async (req, res) => {
    const { name, company, email, message } = req.body;
    if (!name || !company || !email || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    try {
        const result = await query(
            `INSERT INTO enquiries (name, company, email, message)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [name, company, email, message]
        );
        const enquiry = result.rows[0];

        await query(
            `INSERT INTO audit_log (action_type, actor_role, actor_id, target_id, details)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                'CONTACT_FORM_SUBMITTED',
                'public',
                '00000000-0000-0000-0000-000000000000',
                null,
                JSON.stringify({ name, company, email, enquiry_id: enquiry.id })
            ]
        );

        try {
            await sendContactEnquiry({ name, company, email, message });
        } catch (mailErr) {
            console.error('[contact] Email send failed (non-fatal):', mailErr.message);
        }

        try {
            emitDashboardEvent('new_enquiry', {
                id: enquiry.id,
                name,
                company,
                email,
                message,
                status: 'new',
                created_at: enquiry.created_at
            });
        } catch (socketErr) {
            console.error('[contact] Socket emit failed (non-fatal):', socketErr.message);
        }

        return res.status(200).json({ message: 'Thank you. We will be in touch.' });
    } catch (err) {
        console.error('[contact] error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/contact — manager only, fetch all enquiries
router.get('/', requireAuth, async (req, res) => {
    try {
        const result = await query(
            `SELECT * FROM enquiries ORDER BY created_at DESC`
        );
        return res.status(200).json(result.rows);
    } catch (err) {
        console.error('[contact] fetch error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/contact/:id — manager only, update status
router.patch('/:id', requireAuth, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    if (!['new', 'read', 'responded'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
    }
    try {
        const result = await query(
            `UPDATE enquiries SET status = $1 WHERE id = $2 RETURNING *`,
            [status, id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Enquiry not found' });
        }
        return res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error('[contact] update error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
