import { useState, useEffect } from 'react';

const PURPLE_NOTE = {
    background: 'rgba(108,99,255,0.08)',
    border: '1px solid rgba(108,99,255,0.2)',
    borderLeft: '3px solid #6C63FF',
    borderRadius: '8px',
    padding: '10px 14px',
    marginTop: '12px',
    fontSize: '13px',
    lineHeight: 1.6,
    color: '#2D2D2D',
};

const AMBER_NOTE = {
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.2)',
    borderLeft: '3px solid #F59E0B',
    borderRadius: '8px',
    padding: '10px 14px',
    marginTop: '12px',
    fontSize: '13px',
    lineHeight: 1.6,
    color: '#2D2D2D',
};

function Step({ n, children }) {
    return (
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', marginBottom: '8px' }}>
            <span style={{
                flexShrink: 0, width: 22, height: 22, borderRadius: '50%',
                background: '#6C63FF', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700,
            }}>{n}</span>
            <span style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.6, paddingTop: '2px' }}>{children}</span>
        </div>
    );
}

function PrivacyNote({ children }) {
    return (
        <div style={PURPLE_NOTE}>
            <span style={{ fontWeight: 700, color: '#6C63FF' }}>Privacy: </span>
            {children}
        </div>
    );
}

function CautionNote({ children }) {
    return (
        <div style={AMBER_NOTE}>
            <span style={{ fontWeight: 700, color: '#F59E0B' }}>Note: </span>
            {children}
        </div>
    );
}

function SectionHeading({ children }) {
    return (
        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0D0D0D', margin: '16px 0 8px' }}>
            {children}
        </div>
    );
}

/* ─── Screenshot helper ─── */

function HelpImage({ src, caption }) {
    const [show, setShow] = useState(true);
    if (!show) return null;
    return (
        <figure style={{ margin: '14px 0 4px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <img src={src} alt={caption} onError={() => setShow(false)} style={{ width: '100%', display: 'block' }} />
            {caption && <figcaption style={{ padding: '6px 12px', fontSize: '11px', color: '#6B6B6B', background: 'rgba(0,0,0,0.02)', fontStyle: 'italic' }}>{caption}</figcaption>}
        </figure>
    );
}

/* ─── Content blocks per context ─── */

function BookingFormContent() {
    return (
        <>
            <SectionHeading>Your Booking Access Link</SectionHeading>
            <p style={{ fontSize: '13px', color: '#3D3D3D', margin: '0 0 10px', lineHeight: 1.6 }}>
                When your fleet manager creates your booking, you receive an email from SwiftLink with the subject <strong>"Your SwiftLink booking link"</strong>.
            </p>
            <Step n={1}>Open the email and click or tap the link in the message body.</Step>
            <Step n={2}>You are taken directly to your personal trip dashboard — <strong>no password required</strong>.</Step>
            <Step n={3}>The link is single-use. Once you open it, you are signed in automatically.</Step>
            <CautionNote>
                The link expires if unused for 15 minutes. If it has expired, contact your fleet manager. Check your <strong>spam or junk folder</strong> if you cannot find the email.
            </CautionNote>

            <SectionHeading>What Your Email Is Used For</SectionHeading>
            <div style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.8, paddingLeft: '14px', borderLeft: '2px solid rgba(108,99,255,0.3)' }}>
                <div>• Delivering your booking access link</div>
                <div>• Sending trip status updates (driver assigned, trip complete)</div>
                <div>• Allowing you to recover access to your booking history</div>
            </div>
            <PrivacyNote>
                Your email address is never shared with your driver. Your driver sees only your first name.
            </PrivacyNote>

            <SectionHeading>What You Will See After Signing In</SectionHeading>
            <p style={{ fontSize: '13px', color: '#3D3D3D', margin: 0, lineHeight: 1.7 }}>
                Once signed in, your trip dashboard shows your route, pickup time, current status, driver details once assigned, a secure chat channel, and an option to enable push notifications.
            </p>
            <HelpImage src="/help/client/01-booking-form.png" caption="Your trip dashboard after signing in via the booking link" />
        </>
    );
}

function TripPendingContent() {
    return (
        <>
            <p style={{ fontSize: '13px', color: '#3D3D3D', margin: '0 0 14px', lineHeight: 1.6 }}>
                Your trip has been registered. Your fleet manager is currently assigning a driver and vehicle.
            </p>
            <div style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.8, paddingLeft: '14px', borderLeft: '2px solid rgba(108,99,255,0.3)' }}>
                <div>• You do not need to do anything at this stage.</div>
                <div>• This page updates automatically when a driver is assigned.</div>
                <div>• You may receive a push notification when your driver is confirmed.</div>
            </div>
            <CautionNote>
                If your pickup time is approaching and no driver has been assigned, contact your fleet manager directly.
            </CautionNote>
            <HelpImage src="/help/client/02-trip-pending.png" caption="Trip dashboard showing a booking awaiting driver assignment" />
        </>
    );
}

function TripAcceptedContent() {
    return (
        <>
            <SectionHeading>Your Driver and Vehicle</SectionHeading>
            <p style={{ fontSize: '13px', color: '#3D3D3D', margin: '0 0 10px', lineHeight: 1.6 }}>
                A driver has been assigned. You can see their <strong>first name</strong>, vehicle <strong>make, model, and registration plate</strong>, and the <strong>ETA</strong> if your fleet manager has set one.
            </p>
            <PrivacyNote>
                You will not see your driver's phone number. All communication goes through the secure in-app chat — this protects both you and the driver.
            </PrivacyNote>

            <SectionHeading>Messaging Your Driver</SectionHeading>
            <Step n={1}>Scroll down to the <strong>Secure Channel</strong> section.</Step>
            <Step n={2}>Type your message and tap <strong>Send</strong>. Your driver receives it in real time.</Step>
            <Step n={3}>Use this to confirm pickup landmarks or flag any last-minute changes.</Step>

            <SectionHeading>Cancelling Your Trip</SectionHeading>
            <Step n={1}>Tap <strong>"Cancel Trip"</strong> on your trip page.</Step>
            <Step n={2}>Confirm the cancellation when prompted.</Step>
            <Step n={3}>Your fleet manager is notified automatically.</Step>
            <CautionNote>
                Cancellation is only available before the driver starts the journey. Once the trip is underway, contact your fleet manager directly.
            </CautionNote>
            <HelpImage src="/help/client/03-trip-accepted.png" caption="Driver card showing first name, vehicle, registration plate, and ETA" />
        </>
    );
}

function TripActiveContent() {
    return (
        <>
            <p style={{ fontSize: '13px', color: '#3D3D3D', margin: '0 0 14px', lineHeight: 1.6 }}>
                Your driver has confirmed your pickup and started the journey. The secure chat channel is open.
            </p>

            <SectionHeading>Communicating With Your Driver</SectionHeading>
            <Step n={1}>Use the <strong>Secure Channel</strong> section on your screen.</Step>
            <Step n={2}>Type your message and tap <strong>Send</strong>.</Step>
            <Step n={3}>If your signal drops briefly, your message will be sent automatically when connectivity is restored — you will see a <strong>⏳</strong> icon until it goes through.</Step>

            <SectionHeading>If Something Goes Wrong</SectionHeading>
            <p style={{ fontSize: '13px', color: '#3D3D3D', margin: '0 0 10px', lineHeight: 1.6 }}>
                Use the chat to raise issues with your driver first. If you cannot resolve it through chat, contact your fleet manager directly by phone.
            </p>

            <SectionHeading>Filing a Complaint After the Trip</SectionHeading>
            <Step n={1}>After the trip ends, a <strong>"File a Complaint"</strong> section will appear on your screen.</Step>
            <Step n={2}>You have <strong>24 hours</strong> from the moment the trip is marked complete.</Step>
            <Step n={3}>Select a complaint category and describe what happened.</Step>
            <CautionNote>
                After the 24-hour complaint window closes, your message history is <strong>permanently deleted</strong>. If you intend to file a complaint, do not wait.
            </CautionNote>
            <PrivacyNote>
                The session and all associated data are destroyed the moment the trip is marked complete. Message content is not kept beyond the complaint window.
            </PrivacyNote>
            <HelpImage src="/help/client/04-trip-active-chat.png" caption="Active trip view with the Secure Channel chat open" />
        </>
    );
}

function TripEndedContent() {
    return (
        <>
            <SectionHeading>If the trip was completed normally</SectionHeading>
            <p style={{ fontSize: '13px', color: '#3D3D3D', margin: '0 0 10px', lineHeight: 1.6 }}>
                You have up to <strong>24 hours</strong> to file a complaint if needed. Look for the "File a Complaint" section on your screen.
            </p>
            <CautionNote>
                After 24 hours, all message content is permanently deleted. Act promptly if you need to raise an issue.
            </CautionNote>

            <SectionHeading>If the trip was cancelled</SectionHeading>
            <p style={{ fontSize: '13px', color: '#3D3D3D', margin: 0, lineHeight: 1.6 }}>
                The booking has been cancelled and the session was closed. Contact your fleet manager if you need a new booking.
            </p>
            <HelpImage src="/help/client/05-trip-ended-complaint.png" caption="Completed trip showing the File a Complaint section with 24-hour countdown" />
        </>
    );
}

function HistoryContent() {
    return (
        <>
            <SectionHeading>What You Can See Here</SectionHeading>
            <p style={{ fontSize: '13px', color: '#3D3D3D', margin: '0 0 10px', lineHeight: 1.6 }}>
                This view shows all trips registered under your corporate email — pickup location, destination, date and time, assigned driver, vehicle, and trip status.
            </p>

            <SectionHeading>Why You Cannot Edit or Cancel Here</SectionHeading>
            <p style={{ fontSize: '13px', color: '#3D3D3D', margin: '0 0 10px', lineHeight: 1.6 }}>
                History access is a <strong>temporary, read-only session</strong> valid for <strong>2 hours</strong> from when you opened the recovery link. To make changes to an upcoming booking, contact your fleet manager.
            </p>

            <SectionHeading>Why Some Details May Be Missing</SectionHeading>
            <div style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.8 }}>
                <div style={{ marginBottom: '6px' }}>• <strong>Message content</strong> from completed trips is not retained unless a complaint was filed — this is by design.</div>
                <div>• <strong>Cancelled trips</strong> appear in the list with their status — route and booking details are preserved for your records.</div>
            </div>
            <PrivacyNote>
                Your history session expires automatically after 2 hours. This limits the exposure of your booking records on shared or unattended devices.
            </PrivacyNote>
            <HelpImage src="/help/client/06-booking-history.png" caption="Booking history page showing all trips under your corporate email" />
        </>
    );
}

/* ─── Title map ─── */

const TITLES = {
    'booking-form':  'How Your Booking Works',
    'trip-pending':  'Booking Confirmed — Driver Pending',
    'trip-accepted': 'Your Trip is Confirmed',
    'trip-active':   'Your Trip is Underway',
    'trip-ended':    'Your Trip Has Ended',
    'history':       'Your Booking History',
};

/* ─── Modal component ─── */

export default function ClientHelpModal({ context }) {
    const [open, setOpen] = useState(false);
    const title = TITLES[context] || TITLES['booking-form'];

    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [open]);

    return (
        <>
            {/* Floating ? button */}
            <button
                onClick={() => setOpen(true)}
                title="Help"
                style={{
                    position: 'fixed', bottom: '88px', right: '20px', zIndex: 50,
                    height: '44px', padding: '0 20px', borderRadius: '9999px',
                    background: '#6C63FF',
                    boxShadow: '0 4px 16px rgba(108,99,255,0.45)',
                    border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '6px',
                    color: '#fff', fontSize: '14px', fontWeight: 800,
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.05)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(108,99,255,0.55)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)';    e.currentTarget.style.boxShadow = '0 4px 16px rgba(108,99,255,0.45)'; }}
            >
                ? Help
            </button>

            {/* Backdrop */}
            <div
                onClick={() => setOpen(false)}
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 99,
                    opacity: open ? 1 : 0,
                    pointerEvents: open ? 'auto' : 'none',
                    transition: 'opacity 0.25s ease',
                }}
            />

            {/* Sheet */}
            <div
                style={{
                    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
                    background: 'rgba(245,237,227,0.97)',
                    backdropFilter: 'blur(40px)',
                    WebkitBackdropFilter: 'blur(40px)',
                    borderRadius: '24px 24px 0 0',
                    borderTop: '1px solid rgba(255,255,255,0.7)',
                    boxShadow: '0 -8px 40px rgba(0,0,0,0.12)',
                    maxHeight: '85vh',
                    display: 'flex',
                    flexDirection: 'column',
                    transform: open ? 'translateY(0)' : 'translateY(100%)',
                    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
            >
                {/* Drag handle */}
                <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 0' }}>
                    <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'rgba(0,0,0,0.15)' }} />
                </div>

                {/* Header */}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 20px 0',
                }}>
                    <div>
                        <div style={{ fontSize: '18px', fontWeight: 900, color: '#0D0D0D', letterSpacing: '-0.02em' }}>
                            {title}
                        </div>
                        <div style={{ fontSize: '11px', color: '#6B6B6B', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                            Client Help
                        </div>
                    </div>
                    <button
                        onClick={() => setOpen(false)}
                        style={{
                            background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%',
                            width: '32px', height: '32px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', fontSize: '18px', color: '#6B6B6B', lineHeight: 1,
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Scrollable content */}
                <div style={{ overflowY: 'auto', padding: '16px 20px 40px', flex: 1 }}>
                    {context === 'booking-form'  && <BookingFormContent />}
                    {context === 'trip-pending'  && <TripPendingContent />}
                    {context === 'trip-accepted' && <TripAcceptedContent />}
                    {context === 'trip-active'   && <TripActiveContent />}
                    {context === 'trip-ended'    && <TripEndedContent />}
                    {context === 'history'       && <HistoryContent />}
                </div>
            </div>
        </>
    );
}
