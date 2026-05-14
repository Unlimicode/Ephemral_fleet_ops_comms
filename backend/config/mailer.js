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
        `Your booking has been received.\n\n` +
        `Open your personal trip dashboard here:\n${magicLink}\n\n` +
        `WHAT YOU CAN DO FROM YOUR DASHBOARD\n` +
        `• Track your booking status in real time\n` +
        `• See your assigned driver and vehicle details once confirmed\n` +
        `• Message your driver securely before and during the trip\n` +
        `• Cancel or update your booking before departure\n` +
        `• File a complaint within 24 hours of trip completion\n\n` +
        `WHAT HAPPENS NEXT\n` +
        `1. Your fleet manager is assigning a driver and vehicle.\n` +
        `2. You will receive another email when your driver is confirmed.\n` +
        `3. Once assigned, open your dashboard to see driver details and start chatting.\n\n` +
        `PRIVACY\n` +
        `Your contact details are never shared with your driver. All communication goes through SwiftLink's secure channel.\n\n` +
        `Do not share this link — it grants direct access to your booking session.`;

    const html = buildHtml(`
      <!-- Status badge -->
      <div style="display:inline-block;background:rgba(0,168,107,0.12);color:#00A86B;border:1px solid rgba(0,168,107,0.25);
                  border-radius:9999px;padding:4px 14px;font-size:11px;font-weight:800;letter-spacing:0.1em;
                  text-transform:uppercase;margin-bottom:20px;">
        ✓ Booking Confirmed
      </div>

      <h2 style="margin:0 0 10px;font-size:24px;font-weight:900;letter-spacing:-0.03em;color:#1a1a1a;line-height:1.2;">
        Your trip is booked
      </h2>
      <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#444444;">
        Use the button below to access your personal trip dashboard — track your booking, see driver details, and chat securely once your driver is assigned.
      </p>

      <!-- Primary CTA -->
      <div style="text-align:center;margin:0 0 32px;">
        <a href="${magicLink}"
           style="display:inline-block;background:#1a1a1a;color:#ffffff;padding:15px 36px;border-radius:10px;
                  text-decoration:none;font-weight:800;font-size:15px;font-family:system-ui,sans-serif;
                  letter-spacing:-0.01em;">
          Open My Trip Dashboard →
        </a>
      </div>

      <!-- What happens next -->
      <div style="background:rgba(0,0,0,0.04);border-radius:12px;padding:20px 24px;margin:0 0 20px;">
        <p style="margin:0 0 14px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#888888;">
          What happens next
        </p>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:0 0 12px 0;vertical-align:top;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="width:30px;vertical-align:top;padding-top:2px;">
                    <span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:#1a1a1a;color:#ffffff;text-align:center;line-height:22px;font-size:11px;font-weight:700;">1</span>
                  </td>
                  <td style="font-size:13px;color:#333333;line-height:1.6;padding-left:10px;">Your fleet manager is assigning a driver and vehicle to your booking.</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 12px 0;vertical-align:top;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="width:30px;vertical-align:top;padding-top:2px;">
                    <span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:#1a1a1a;color:#ffffff;text-align:center;line-height:22px;font-size:11px;font-weight:700;">2</span>
                  </td>
                  <td style="font-size:13px;color:#333333;line-height:1.6;padding-left:10px;">You will receive another email when your driver is confirmed, with their name and vehicle details.</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 0 12px 0;vertical-align:top;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="width:30px;vertical-align:top;padding-top:2px;">
                    <span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:#1a1a1a;color:#ffffff;text-align:center;line-height:22px;font-size:11px;font-weight:700;">3</span>
                  </td>
                  <td style="font-size:13px;color:#333333;line-height:1.6;padding-left:10px;">Once assigned, open your dashboard to see driver details and message them securely through the in-app channel.</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0;vertical-align:top;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="width:30px;vertical-align:top;padding-top:2px;">
                    <span style="display:inline-block;width:22px;height:22px;border-radius:50%;background:#1a1a1a;color:#ffffff;text-align:center;line-height:22px;font-size:11px;font-weight:700;">4</span>
                  </td>
                  <td style="font-size:13px;color:#333333;line-height:1.6;padding-left:10px;">After your trip, you have <strong>24 hours</strong> to file a complaint if needed — directly from your dashboard.</td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>

      <!-- What you can do -->
      <div style="background:rgba(0,0,0,0.04);border-radius:12px;padding:20px 24px;margin:0 0 20px;">
        <p style="margin:0 0 12px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#888888;">
          Your dashboard lets you
        </p>
        <ul style="margin:0;padding-left:18px;color:#333333;font-size:13px;line-height:2;">
          <li>Track your booking status in real time</li>
          <li>See your assigned driver and vehicle once confirmed</li>
          <li>Cancel or update your booking before departure</li>
          <li>Message your driver through the secure in-app channel</li>
          <li>File a complaint within 24 hours of trip completion</li>
        </ul>
      </div>

      <!-- Privacy note -->
      <div style="background:rgba(108,99,255,0.07);border:1px solid rgba(108,99,255,0.18);border-left:3px solid #6C63FF;
                  border-radius:10px;padding:14px 18px;margin:0 0 16px;">
        <p style="margin:0;font-size:13px;color:#333333;line-height:1.6;">
          <strong style="color:#6C63FF;">Privacy:</strong> Your contact details are never shared with your driver.
          All communication goes through SwiftLink's secure channel — neither side's personal details are ever exposed to the other.
        </p>
      </div>

      <!-- Security warning -->
      <p style="margin:0;font-size:12px;color:#888888;line-height:1.5;">
        ⚠️ This link is personal and single-use. Do not forward it — anyone with this link can access your booking session.
      </p>
    `);

    await sendEmail({ to, subject: 'Your SwiftLink booking link', text, html });
};

// ── 2. Driver assigned notification ───────────────────────────────────────────
export const sendDriverAssignedNotification = async (to, driverFirstName, vehicleType) => {
    const text =
        `Your driver ${driverFirstName} has accepted your trip and is on the way in a ${vehicleType}.\n\n` +
        `Open your booking dashboard to:\n` +
        `• See your driver's vehicle details\n` +
        `• Message your driver through the secure in-app channel\n` +
        `• Track your trip status in real time\n\n` +
        `Your driver's contact details are not included — all communication goes through SwiftLink's secure channel.`;

    const html = buildHtml(`
      <!-- Status badge -->
      <div style="display:inline-block;background:rgba(108,99,255,0.1);color:#6C63FF;border:1px solid rgba(108,99,255,0.25);
                  border-radius:9999px;padding:4px 14px;font-size:11px;font-weight:800;letter-spacing:0.1em;
                  text-transform:uppercase;margin-bottom:20px;">
        Driver Confirmed
      </div>

      <h2 style="margin:0 0 10px;font-size:24px;font-weight:900;letter-spacing:-0.03em;color:#1a1a1a;line-height:1.2;">
        Your driver is on the way
      </h2>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#444444;">
        <strong>${driverFirstName}</strong> has accepted your trip and will be arriving in a <strong>${vehicleType}</strong>.
        Open your dashboard to message them and track the journey.
      </p>

      <!-- Driver detail card -->
      <div style="background:rgba(0,0,0,0.04);border-radius:12px;padding:20px 24px;margin:0 0 20px;">
        <p style="margin:0 0 14px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#888888;">
          Your driver
        </p>
        <div style="display:flex;gap:16px;align-items:center;">
          <div style="width:44px;height:44px;border-radius:50%;background:#1a1a1a;color:#F5EDE3;
                      display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:900;flex-shrink:0;">
            ${driverFirstName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style="font-size:16px;font-weight:800;color:#1a1a1a;">${driverFirstName}</div>
            <div style="font-size:13px;color:#666666;margin-top:2px;">${vehicleType}</div>
          </div>
        </div>
      </div>

      <!-- What to do now -->
      <div style="background:rgba(0,0,0,0.04);border-radius:12px;padding:20px 24px;margin:0 0 20px;">
        <p style="margin:0 0 12px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#888888;">
          What to do now
        </p>
        <ul style="margin:0;padding-left:18px;color:#333333;font-size:13px;line-height:2;">
          <li>Open your booking dashboard to see full vehicle details</li>
          <li>Use the <strong>Secure Channel</strong> to message your driver directly</li>
          <li>Confirm your pickup point if needed</li>
        </ul>
      </div>

      <!-- Privacy note -->
      <div style="background:rgba(108,99,255,0.07);border:1px solid rgba(108,99,255,0.18);border-left:3px solid #6C63FF;
                  border-radius:10px;padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:#333333;line-height:1.6;">
          <strong style="color:#6C63FF;">Privacy:</strong> Your driver's phone number is not included in this notification and will never be shared with you. All communication is mediated through SwiftLink's secure channel.
        </p>
      </div>
    `);

    await sendEmail({ to, subject: 'Your driver has been assigned', text, html });
};

// ── 3. Trip completion notification ───────────────────────────────────────────
export const sendTripCompletionNotification = async (to, complaintWindowHours) => {
    const text =
        `Your trip has been completed.\n\n` +
        `You have ${complaintWindowHours} hours to file a complaint if needed — open your booking dashboard to do so.\n\n` +
        `After the ${complaintWindowHours}-hour window closes, all trip session data and message content is permanently deleted from SwiftLink's servers. No action is needed if everything went well.\n\n` +
        `Thank you for using SwiftLink.`;

    const html = buildHtml(`
      <!-- Status badge -->
      <div style="display:inline-block;background:rgba(0,168,107,0.12);color:#00A86B;border:1px solid rgba(0,168,107,0.25);
                  border-radius:9999px;padding:4px 14px;font-size:11px;font-weight:800;letter-spacing:0.1em;
                  text-transform:uppercase;margin-bottom:20px;">
        ✓ Trip Complete
      </div>

      <h2 style="margin:0 0 10px;font-size:24px;font-weight:900;letter-spacing:-0.03em;color:#1a1a1a;line-height:1.2;">
        You have arrived safely
      </h2>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#444444;">
        Your trip has been completed. No action is needed if everything went well.
      </p>

      <!-- Complaint window -->
      <div style="background:rgba(0,0,0,0.04);border-radius:12px;padding:20px 24px;margin:0 0 20px;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#888888;">
          Complaint window
        </p>
        <p style="margin:0 0 12px;font-size:32px;font-weight:900;letter-spacing:-0.04em;color:#1a1a1a;line-height:1;">
          ${complaintWindowHours} hours
        </p>
        <p style="margin:0 0 12px;font-size:13px;color:#555555;line-height:1.6;">
          If something went wrong during this trip, open your booking dashboard and use the <strong>File a Complaint</strong> section. You have <strong>${complaintWindowHours} hours</strong> from now.
        </p>
        <p style="margin:0;font-size:12px;color:#888888;line-height:1.5;">
          After this window closes, your complaint cannot be filed and all session data is permanently deleted.
        </p>
      </div>

      <!-- Data lifecycle note -->
      <div style="background:rgba(108,99,255,0.07);border:1px solid rgba(108,99,255,0.18);border-left:3px solid #6C63FF;
                  border-radius:10px;padding:14px 18px;">
        <p style="margin:0;font-size:13px;color:#333333;line-height:1.6;">
          <strong style="color:#6C63FF;">Data lifecycle:</strong> All trip session keys and message content are permanently deleted from SwiftLink's servers the moment a trip is completed. Only your booking record (route, time, driver name, vehicle) is retained for fleet management purposes.
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

// ── Driver password reset ─────────────────────────────────────────────────────
export const sendDriverPasswordReset = async (to, driverFullName, resetUrl) => {
    const firstName = (driverFullName || '').split(' ')[0] || 'there';
    const text =
        `Hi ${firstName},\n\n` +
        `Your fleet manager has issued a password reset for your SwiftLink driver account.\n\n` +
        `Open this link to set a new password (expires in 1 hour, single-use):\n${resetUrl}\n\n` +
        `If you did not request this, you can safely ignore this email.`;

    const html = buildHtml(`
      <div style="display:inline-block;background:rgba(108,99,255,0.10);color:#6C63FF;border:1px solid rgba(108,99,255,0.25);
                  border-radius:9999px;padding:4px 14px;font-size:11px;font-weight:800;letter-spacing:0.1em;
                  text-transform:uppercase;margin-bottom:20px;">
        Password Reset
      </div>
      <h2 style="margin:0 0 10px;font-size:24px;font-weight:900;letter-spacing:-0.03em;color:#1a1a1a;line-height:1.2;">
        Set a new password
      </h2>
      <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#444444;">
        Hi ${firstName} — your fleet manager has issued a password reset for your driver account.
        Use the button below to choose a new password.
      </p>
      <div style="text-align:center;margin:0 0 28px;">
        <a href="${resetUrl}"
           style="display:inline-block;background:#1a1a1a;color:#ffffff;padding:15px 36px;border-radius:10px;
                  text-decoration:none;font-weight:800;font-size:15px;font-family:system-ui,sans-serif;
                  letter-spacing:-0.01em;">
          Set new password →
        </a>
      </div>
      <p style="margin:0 0 8px;font-size:12px;color:#888888;line-height:1.5;">
        This link expires in <strong>1 hour</strong> and can only be used once.
      </p>
      <p style="margin:0;font-size:12px;color:#888888;line-height:1.5;">
        If you did not request this, you can safely ignore this email — your password will not change.
      </p>
    `);

    await sendEmail({ to, subject: 'Reset your SwiftLink driver password', text, html });
};

// ── 6. Corporate contact enquiry ──────────────────────────────────────────────
export async function sendContactEnquiry({ name, company, email, message }) {
    await client.transactionalEmails.sendTransacEmail({
        sender: { email: process.env.MAIL_FROM || 'noreply@swiftlink.app', name: 'SwiftLink' },
        to: [{ email: process.env.CONTACT_ENQUIRY_EMAIL || process.env.MAIL_FROM || 'noreply@swiftlink.app' }],
        replyTo: { email, name },
        subject: `Corporate Enquiry — ${company}`,
        htmlContent: `
            <div style="font-family: Inter, sans-serif; max-width: 600px; padding: 32px;">
                <h2 style="margin: 0 0 24px; font-size: 20px;">New Corporate Enquiry</h2>
                <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                    <tr><td style="padding: 8px 0; color: #666; width: 120px;">Name</td><td style="padding: 8px 0; font-weight: 600;">${name}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">Company</td><td style="padding: 8px 0; font-weight: 600;">${company}</td></tr>
                    <tr><td style="padding: 8px 0; color: #666;">Email</td><td style="padding: 8px 0;"><a href="mailto:${email}">${email}</a></td></tr>
                    <tr><td style="padding: 8px 0; color: #666; vertical-align: top;">Message</td><td style="padding: 8px 0; line-height: 1.6;">${message}</td></tr>
                </table>
            </div>
        `
    });
}

export default client;
