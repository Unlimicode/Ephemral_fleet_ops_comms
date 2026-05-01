import { BrevoClient } from '@getbrevo/brevo';

const client = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY || 'test_placeholder'
});

export const sendEmail = async ({ to, subject, text }) => {
    await client.transactionalEmails.sendTransacEmail({
        sender: { email: process.env.MAIL_FROM || 'noreply@swiftlink.app', name: 'SwiftLink' },
        to: [{ email: to }],
        subject,
        textContent: text
    });
};

export const sendComplaintStatusUpdate = async (to, complaintId, newStatus, investigationNotes) => {
    const statusLabels = {
        open: 'Open',
        under_investigation: 'Under Investigation',
        resolved: 'Resolved',
    };
    const label = statusLabels[newStatus] || newStatus.replace(/_/g, ' ');
    const ref = complaintId.slice(0, 8).toUpperCase();
    const notesLine = investigationNotes
        ? `\n\nInvestigation Notes:\n${investigationNotes}`
        : '';
    await sendEmail({
        to,
        subject: `Complaint Status Update — ${label}`,
        text: `Your complaint (ID: ${ref}) status has been updated to: ${label}.${notesLine}\n\nLog in to SwiftLink to view your booking details.`,
    });
};

export default client;
