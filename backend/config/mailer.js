import { BrevoClient } from '@getbrevo/brevo';

const client = new BrevoClient({
    apiKey: process.env.BREVO_API_KEY || 'test_placeholder'
});

export const sendEmail = async ({ to, subject, text, html }) => {
    await client.transactionalEmails.sendTransacEmail({
        sender: { email: process.env.MAIL_FROM || 'noreply@swiftlink.app', name: 'SwiftLink' },
        to: [{ email: to }],
        subject,
        textContent: text,
        ...(html ? { htmlContent: html } : {})
    });
};

// ── HTML shell ─────────────────────────────────────────────────────────────────
const buildHtml = (bodyHtml) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>SwiftLink</title>
</head>
<body style="margin:0;padding:16px 0;background:#F5EDE3;font-family:system-ui,sans-serif;color:#1a1a1a;">
  <div style="max-width:600px;width:100%;margin:0 auto;background:#F5EDE3;border-radius:12px;overflow:hidden;">
    <div style="background:#1a1a1a;padding:22px 32px;">
      <span style="color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-0.03em;font-family:system-ui,sans-serif;">SwiftLink</span>
    </div>
    <div style="padding:32px;">
      ${bodyHtml}
    </div>
    <div style="padding:16px 32px 28px;border-top:1px solid rgba(0,0,0,0.08);">
      <p style="margin:0;font-size:11px;color:#888888;font-family:system-ui,sans-serif;">SwiftLink — Privacy-first fleet operations</p>
    </div>
  </div>
</body>
</html>`;

// ── 1. Booking confirmation — magic link ───────────────────────────────────────
export const sendBookingConfirmation = async (to, magicLink) => {
    const text =
        `Your booking has been received. Use the link below to track your trip and communicate with your driver. This link is valid for the duration of your trip.\n\n` +
        `${magicLink}\n\n` +
        `Do not share this link with anyone.`;

    const html = buildHtml(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;letter-spacing:-0.03em;color:#1a1a1a;">Booking Confirmed</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#1a1a1a;">
        Your booking has been received. Use the link below to track your trip and communicate with your driver.
        This link is valid for the duration of your trip.
      </p>
      <div style="text-align:center;margin:32px 0;">
        <a href="${magicLink}"
           style="display:inline-block;background:#1a1a1a;color:#ffffff;padding:14px 32px;border-radius:8px;
                  text-decoration:none;font-weight:700;font-size:15px;font-family:system-ui,sans-serif;
                  letter-spacing:-0.01em;">
          Open My Booking
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:#666666;line-height:1.5;">
        Do not share this link — it grants direct access to your booking session.
      </p>
    `);

    await sendEmail({ to, subject: 'Your SwiftLink booking link', text, html });
};

// ── 2. Driver assigned notification ───────────────────────────────────────────
export const sendDriverAssignedNotification = async (to, driverFirstName, vehicleType) => {
    const text =
        `Your driver ${driverFirstName} is on the way in a ${vehicleType}. ` +
        `Use your booking link to message them directly.`;

    const html = buildHtml(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;letter-spacing:-0.03em;color:#1a1a1a;">Driver Assigned</h2>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#1a1a1a;">
        Your driver <strong>${driverFirstName}</strong> is on the way in a <strong>${vehicleType}</strong>.
        Use your booking link to message them directly.
      </p>
      <div style="background:rgba(0,0,0,0.04);border-radius:8px;padding:16px 20px;margin:0 0 20px;">
        <p style="margin:0;font-size:13px;color:#555555;line-height:1.5;">
          🔒 Contact details are structurally excluded from this session. All communication goes through the SwiftLink mediated channel.
        </p>
      </div>
    `);

    await sendEmail({ to, subject: 'Your driver has been assigned', text, html });
};

// ── 3. Trip completion notification ───────────────────────────────────────────
export const sendTripCompletionNotification = async (to, complaintWindowHours) => {
    const text =
        `Your trip has been completed. You have ${complaintWindowHours} hours to file a complaint if needed. ` +
        `After this window closes, all trip data will be permanently deleted in line with our privacy policy.\n\n` +
        `No action needed if everything went well.`;

    const html = buildHtml(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;letter-spacing:-0.03em;color:#1a1a1a;">Trip Complete</h2>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#1a1a1a;">
        Your trip has been completed. You have <strong>${complaintWindowHours} hours</strong> to file a complaint
        if needed. After this window closes, all trip data will be permanently deleted in line with our privacy policy.
      </p>
      <div style="background:rgba(0,0,0,0.04);border-radius:8px;padding:16px 20px;margin:0 0 20px;">
        <p style="margin:0;font-size:13px;color:#555555;line-height:1.5;">
          No action needed if everything went well.
        </p>
      </div>
    `);

    await sendEmail({ to, subject: 'Your trip is complete', text, html });
};

// ── 4. Complaint confirmation ──────────────────────────────────────────────────
export const sendComplaintConfirmation = async (to, complaintId) => {
    const ref = complaintId.slice(0, 8).toUpperCase();
    const text =
        `We've received your complaint (ID: ${ref}). Our team will review it and update you by email as the investigation progresses.`;

    const html = buildHtml(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;letter-spacing:-0.03em;color:#1a1a1a;">Complaint Received</h2>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#1a1a1a;">
        We've received your complaint (ID: <strong>${ref}</strong>). Our team will review it and update you
        by email as the investigation progresses.
      </p>
      <div style="background:rgba(0,0,0,0.04);border-radius:8px;padding:16px 20px;">
        <p style="margin:0;font-size:13px;color:#555555;line-height:1.5;">
          You can check the current status of your complaint at any time from your booking page.
        </p>
      </div>
    `);

    await sendEmail({ to, subject: `Complaint received — ID: ${ref}`, text, html });
};

// ── 5. Complaint status update ─────────────────────────────────────────────────
export const sendComplaintStatusUpdate = async (to, complaintId, newStatus, investigationNotes) => {
    const statusLabels = {
        open:                'Reopened',
        under_investigation: 'Under Investigation',
        resolved:            'Resolved',
        escalated:           'Escalated',
    };
    const label = statusLabels[newStatus] || newStatus.replace(/_/g, ' ');
    const ref = complaintId.slice(0, 8).toUpperCase();

    const resolutionNote = (newStatus === 'resolved' && investigationNotes)
        ? `\n\nResolution note:\n${investigationNotes}`
        : '';

    const text =
        `Your complaint (ID: ${ref}) has been updated to: ${label}.${resolutionNote}\n\n` +
        `Log in to SwiftLink to view your booking details.`;

    const resolutionNoteHtml = (newStatus === 'resolved' && investigationNotes)
        ? `<div style="background:rgba(0,0,0,0.04);border-radius:8px;padding:16px 20px;margin:20px 0 0;">
             <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#888888;">Resolution Note</p>
             <p style="margin:0;font-size:14px;color:#1a1a1a;line-height:1.6;">${investigationNotes}</p>
           </div>`
        : '';

    const html = buildHtml(`
      <h2 style="margin:0 0 16px;font-size:22px;font-weight:800;letter-spacing:-0.03em;color:#1a1a1a;">Complaint Update</h2>
      <p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:#1a1a1a;">
        Your complaint (ID: <strong>${ref}</strong>) has been updated to:
      </p>
      <p style="margin:0 0 4px;font-size:24px;font-weight:900;letter-spacing:-0.04em;color:#1a1a1a;">${label}</p>
      ${resolutionNoteHtml}
    `);

    await sendEmail({ to, subject: `Complaint update — ${label}`, text, html });
};

export default client;
