import { Router } from 'express';
import { query } from '../config/db.js';

const router = Router();

// POST /api/contact
// Public endpoint for corporate enquiries.
router.post('/', async (req, res) => {
    const { name, company, email, message } = req.body;

    if (!name || !company || !email || !message) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Log the enquiry to the audit log
        await query(
            `INSERT INTO audit_log (action_type, actor_role, target_id, details)
             VALUES ($1, $2, $3, $4)`,
            ['CONTACT_FORM_SUBMITTED', 'client', null, JSON.stringify({ name, company, email })]
        );

        console.log(`[contact] Enquiry from ${name} (${company}): ${message}`);

        return res.status(200).json({ message: 'Thank you. We will be in touch.' });
    } catch (err) {
        console.error('[contact] error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
