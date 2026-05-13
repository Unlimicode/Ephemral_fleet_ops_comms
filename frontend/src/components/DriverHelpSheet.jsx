import { useState, useEffect } from 'react';

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

function StatusRow({ label, colour, meaning }) {
    const map = {
        amber: { bg: 'rgba(245,158,11,0.15)', text: '#92400E', border: 'rgba(245,158,11,0.3)' },
        green: { bg: 'rgba(0,212,100,0.15)', text: '#065F46', border: 'rgba(0,212,100,0.3)' },
        grey:  { bg: 'rgba(0,0,0,0.07)',     text: '#6B6B6B', border: 'rgba(0,0,0,0.1)'      },
        red:   { bg: 'rgba(239,68,68,0.12)', text: '#991B1B', border: 'rgba(239,68,68,0.2)'  },
    };
    const c = map[colour];
    return (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
            <span style={{
                flexShrink: 0, display: 'inline-block', padding: '3px 10px', borderRadius: '9999px',
                background: c.bg, color: c.text, border: `1px solid ${c.border}`,
                fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', marginTop: '1px',
            }}>{label}</span>
            <span style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.5 }}>{meaning}</span>
        </div>
    );
}

/* ─── Content blocks per context ─── */

function TripsListContent() {
    return (
        <>
            <SectionHeading>Understanding Trip Status</SectionHeading>
            <StatusRow label="Assigned" colour="amber" meaning="You have been assigned this trip. Review the details and accept or decline before pickup time." />
            <StatusRow label="In Progress" colour="green" meaning="Trip is active. Tap 'View Active Trip' to open the trip interface and chat channel." />
            <StatusRow label="Completed" colour="grey" meaning="Trip is done. Session data has been permanently wiped." />
            <StatusRow label="Cancelled" colour="red" meaning="The client cancelled this booking. No action needed." />

            <SectionHeading>Accepting a Trip</SectionHeading>
            <Step n={1}>Read the full trip card: client first name, pickup location, destination, pickup time, and assigned vehicle.</Step>
            <Step n={2}>Check the <strong>purple note box</strong> if present — it contains special instructions from your fleet manager. Read it before accepting.</Step>
            <Step n={3}>If a <strong>flight number</strong> is shown, this is an airport trip. Account for potential flight delays.</Step>
            <Step n={4}>Tap <strong>"Accept"</strong>. The trip moves to In Progress. A secure chat session opens and the client is notified.</Step>
            <PrivacyNote>
                Once you accept, the client can see your first name and vehicle registration. No other personal details are shared with them.
            </PrivacyNote>

            <SectionHeading>Declining a Trip</SectionHeading>
            <Step n={1}>Tap <strong>"Decline"</strong> on an Assigned trip card.</Step>
            <Step n={2}>Enter a reason — <strong>this is required</strong>. Examples: "Vehicle mechanical issue", "Road closure on route".</Step>
            <Step n={3}>Tap <strong>"Confirm Decline"</strong>. The trip returns to your fleet manager for reassignment.</Step>
            <CautionNote>
                Decline reasons are reviewed by your fleet manager. They are not shared with the client.
            </CautionNote>
            <HelpImage src="/help/driver/01-trips-list.jpg" caption="Your Trips list showing Assigned, In Progress, Completed, and Cancelled cards" />
        </>
    );
}

function TripDetailContent() {
    return (
        <>
            <p style={{ fontSize: '13px', color: '#6B6B6B', margin: '0 0 4px', lineHeight: 1.5 }}>
                You land here by tapping <strong>"View Active Trip"</strong> from your Trips list. The trip is already underway — the secure chat channel is open and the client has been notified.
            </p>

            <SectionHeading>Step 1 — Communicate During the Trip</SectionHeading>
            <p style={{ fontSize: '13px', color: '#3D3D3D', margin: '0 0 10px', lineHeight: 1.6 }}>
                The <strong>🔒 Secure Channel</strong> panel is the only authorised way to communicate with your client during a trip.
            </p>
            <Step n={1}>Type a message in the box at the bottom of the chat panel and tap <strong>Send</strong>.</Step>
            <Step n={2}>If you briefly lose signal, any message you sent shows a <strong>⏳</strong> icon. It will be delivered automatically when your connection restores. Keep the app open in the background.</Step>
            <PrivacyNote>
                You will not see the client's phone number or email at any point. All communication is relayed through SwiftLink — neither side's contact details are ever exposed to the other.
            </PrivacyNote>
            <div style={{ fontSize: '13px', color: '#3D3D3D', marginTop: '12px', lineHeight: 1.7 }}>
                <strong>What the client can see about you:</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>
                    <li>Your <strong>first name</strong> only</li>
                    <li>Your <strong>vehicle make, model, and registration plate</strong></li>
                    <li>The <strong>ETA</strong> your manager set when assigning the trip</li>
                </ul>
            </div>

            <SectionHeading>Step 2 — Complete the Trip</SectionHeading>
            <p style={{ fontSize: '13px', color: '#3D3D3D', margin: '0 0 10px', lineHeight: 1.6 }}>
                When the client has been safely dropped off at their destination:
            </p>
            <Step n={1}>Tap <strong>"Complete Trip — Dropped Off ✓"</strong>.</Step>
            <Step n={2}>The trip ends immediately. Both your session and the client's session are destroyed on the server. The chat channel closes.</Step>
            <Step n={3}>The client enters a <strong>24-hour window</strong> during which they can file a complaint if needed.</Step>
            <PrivacyNote>
                After completion, all message content is permanently deleted from the server — unless the client files a complaint within 24 hours.
            </PrivacyNote>
            <HelpImage src="/help/driver/02-active-trip-chat.jpg" caption="Active trip page showing the Secure Channel and the Complete Trip button" />
        </>
    );
}

function ProfileContent() {
    return (
        <>
            <SectionHeading>Your Profile Details</SectionHeading>
            <p style={{ fontSize: '13px', color: '#3D3D3D', margin: '0 0 12px', lineHeight: 1.6 }}>
                Your <strong>full name</strong> and <strong>employee ID</strong> are set by your fleet manager when your account is created. If any details are incorrect, contact your fleet manager to have them updated.
            </p>

            <SectionHeading>Enabling Push Notifications</SectionHeading>
            <p style={{ fontSize: '13px', color: '#3D3D3D', margin: '0 0 10px', lineHeight: 1.6 }}>
                Push notifications alert you when a new trip is assigned or a trip you were assigned to is cancelled.
            </p>
            <Step n={1}>Tap <strong>"Enable Notifications"</strong> on your profile page.</Step>
            <Step n={2}>Your browser shows a permission prompt — tap <strong>"Allow"</strong>.</Step>
            <Step n={3}>The toggle turns on. You will receive alerts even when the app is in the background or the screen is off.</Step>

            <div style={{ marginTop: '12px', fontSize: '13px', color: '#3D3D3D', lineHeight: 1.6 }}>
                <strong>If you denied permission by mistake:</strong>
                <ol style={{ margin: '6px 0 0', paddingLeft: '18px', lineHeight: 1.8 }}>
                    <li>In Chrome for Android: tap the lock icon in the address bar → <strong>Site settings</strong> → <strong>Notifications</strong>.</li>
                    <li>Find SwiftLink and change <strong>Blocked</strong> to <strong>Allowed</strong>.</li>
                    <li>Return to your profile page and tap <strong>"Enable Notifications"</strong> again.</li>
                </ol>
            </div>
            <CautionNote>
                Push notification permissions are tied to your specific browser and device. If you switch to a new phone or browser, you will need to enable notifications again.
            </CautionNote>
            <HelpImage src="/help/driver/03-profile-push.png" caption="Profile page showing the Enable Notifications toggle" />
        </>
    );
}

function NotificationsContent() {
    return (
        <>
            <p style={{ fontSize: '13px', color: '#3D3D3D', margin: '0 0 14px', lineHeight: 1.6 }}>
                This page shows a history of every trip notification sent to your account on this device.
            </p>
            <div style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.8 }}>
                <div style={{ marginBottom: '8px' }}>
                    <strong>Trip assigned</strong> notifications show the client's first name, pickup location, destination, and pickup time.
                </div>
                <div style={{ marginBottom: '8px' }}>
                    <strong>Cancellation</strong> notifications appear with a red indicator. Your fleet manager will follow up about reassignment.
                </div>
                <div>
                    Notifications are stored on the server — they are not lost if you clear your browser cache or reinstall the app.
                </div>
            </div>
            <HelpImage src="/help/driver/04-notifications-list.jpg" caption="Notifications page showing trip assignment and cancellation alerts" />
        </>
    );
}

/* ─── Sheet component ─── */

const CONTEXT_TITLES = {
    'trips-list':    'Your Trips',
    'trip-detail':   'Active Trip Guide',
    'profile':       'Your Profile & Notifications',
    'notifications': 'Your Notifications',
};

function deriveContext(pathname) {
    if (pathname.match(/\/driver\/trips\/(?!active$)[^/]+$/)) return 'trip-detail';
    if (pathname.includes('/driver/trips'))         return 'trips-list';
    if (pathname.includes('/driver/profile'))       return 'profile';
    if (pathname.includes('/driver/notifications')) return 'notifications';
    return 'trips-list';
}

export default function DriverHelpSheet({ open, onClose, pathname }) {
    const context = deriveContext(pathname);
    const title = CONTEXT_TITLES[context];

    // Prevent body scroll while sheet is open
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
            {/* Backdrop */}
            <div
                onClick={onClose}
                style={{
                    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
                    zIndex: 99,
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
                            Driver Help
                        </div>
                    </div>
                    <button
                        onClick={onClose}
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
                    {context === 'trips-list'    && <TripsListContent />}
                    {context === 'trip-detail'   && <TripDetailContent />}
                    {context === 'profile'       && <ProfileContent />}
                    {context === 'notifications' && <NotificationsContent />}
                </div>
            </div>
        </>
    );
}
