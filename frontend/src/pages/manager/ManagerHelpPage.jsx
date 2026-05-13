import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageWrapper from '../../components/layout/PageWrapper.jsx';

const PURPLE_NOTE = {
    background: 'rgba(108,99,255,0.08)',
    border: '1px solid rgba(108,99,255,0.2)',
    borderLeft: '3px solid #6C63FF',
    borderRadius: '8px',
    padding: '12px 16px',
    marginTop: '14px',
    fontSize: '13px',
    lineHeight: 1.6,
    color: '#2D2D2D',
};

const AMBER_NOTE = {
    background: 'rgba(245,158,11,0.08)',
    border: '1px solid rgba(245,158,11,0.2)',
    borderLeft: '3px solid #F59E0B',
    borderRadius: '8px',
    padding: '12px 16px',
    marginTop: '14px',
    fontSize: '13px',
    lineHeight: 1.6,
    color: '#2D2D2D',
};

const TABLE_TH = { padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: '#0D0D0D', fontSize: '13px' };
const TABLE_TD = { padding: '10px 14px', color: '#3D3D3D', fontSize: '13px', lineHeight: 1.5 };
const TABLE_TD_BOLD = { ...TABLE_TD, fontWeight: 600, color: '#0D0D0D', whiteSpace: 'nowrap' };

function Step({ n, children }) {
    return (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '10px' }}>
            <span style={{
                flexShrink: 0, width: 24, height: 24, borderRadius: '50%',
                background: '#6C63FF', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700,
            }}>{n}</span>
            <span style={{ fontSize: '14px', color: '#3D3D3D', lineHeight: 1.6, paddingTop: '2px' }}>{children}</span>
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

function HelpSection({ id, icon, title, subtitle, expanded, onToggle, children }) {
    return (
        <div className="glass-card" style={{ marginBottom: '12px', borderRadius: '16px', overflow: 'hidden' }}>
            <button
                onClick={() => onToggle(id)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
                    padding: '18px 24px', background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left',
                }}
            >
                <span className="material-symbols-outlined" style={{ fontSize: '22px', color: '#6C63FF', flexShrink: 0 }}>
                    {icon}
                </span>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: '#0D0D0D', lineHeight: 1.3 }}>{title}</div>
                    <div style={{ fontSize: '12px', color: '#6B6B6B', marginTop: '3px' }}>{subtitle}</div>
                </div>
                <span
                    className="material-symbols-outlined"
                    style={{
                        fontSize: '20px', color: '#6B6B6B', flexShrink: 0,
                        transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                    }}
                >
                    expand_more
                </span>
            </button>

            {expanded && (
                <div style={{ padding: '4px 24px 24px', borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                    {children}
                </div>
            )}
        </div>
    );
}

function DataTable({ headers, rows }) {
    return (
        <div style={{ overflowX: 'auto', margin: '14px 0' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: 'rgba(108,99,255,0.06)', borderRadius: '8px' }}>
                        {headers.map((h, i) => (
                            <th key={i} style={TABLE_TH}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                            {row.map((cell, j) => (
                                <td key={j} style={j === 0 ? TABLE_TD_BOLD : TABLE_TD}>{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function ManagerHelpPage() {
    const [expanded, setExpanded] = useState('access');
    const navigate = useNavigate();

    const toggle = (id) => setExpanded(prev => prev === id ? null : id);

    return (
        <PageWrapper>
            <div style={{ maxWidth: '760px', margin: '0 auto' }}>

                {/* Back + Header */}
                <div style={{ marginBottom: '32px' }}>
                    <button
                        onClick={() => navigate(-1)}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            color: '#6B6B6B', fontSize: '13px', marginBottom: '20px', padding: 0,
                        }}
                    >
                        <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>arrow_back</span>
                        Back
                    </button>
                    <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#0D0D0D', letterSpacing: '-0.03em', margin: 0 }}>
                        Help Guide
                    </h1>
                    <p style={{ color: '#6B6B6B', fontSize: '14px', marginTop: '6px', marginBottom: 0 }}>
                        Fleet Manager · SwiftLink Operations Centre
                    </p>
                </div>

                {/* 1 — Getting Access */}
                <HelpSection
                    id="access" icon="mail"
                    title="Getting Access"
                    subtitle="How manager authentication works"
                    expanded={expanded === 'access'} onToggle={toggle}
                >
                    <div style={{ paddingTop: '16px' }}>
                        <Step n={1}>Go to the SwiftLink login page and enter your registered work email address.</Step>
                        <Step n={2}>Check your inbox for an email from SwiftLink — it arrives within seconds.</Step>
                        <Step n={3}>Click <strong>"Sign in to SwiftLink"</strong> in the email. You are taken directly to the Dispatch dashboard — no password required.</Step>
                        <Step n={4}>Your session remains active for your current browser session. Closing the browser tab ends it.</Step>
                        <CautionNote>
                            The sign-in link is <strong>single-use and expires after 15 minutes</strong>. If it has expired, return to the login page and request a new one.
                        </CautionNote>
                        <PrivacyNote>
                            SwiftLink uses email magic links instead of passwords. No password is ever created or stored on the system.
                        </PrivacyNote>
                    </div>
                </HelpSection>

                {/* 2 — Creating a Trip Booking */}
                <HelpSection
                    id="booking" icon="add_circle"
                    title="Creating a Trip Booking"
                    subtitle="Registering a new corporate trip on behalf of a client"
                    expanded={expanded === 'booking'} onToggle={toggle}
                >
                    <div style={{ paddingTop: '16px' }}>
                        <Step n={1}>From the <strong>Dispatch</strong> page, click <strong>"+ New Booking"</strong> in the top-right corner. A modal form appears.</Step>
                        <Step n={2}>Enter the client's <strong>first name</strong> and <strong>corporate email address</strong>. Only the first name is stored — no surnames, no phone numbers.</Step>
                        <Step n={3}>Enter the <strong>pickup location</strong> and <strong>destination</strong>.</Step>
                        <Step n={4}>Set the <strong>pickup date and time</strong>.</Step>
                        <Step n={5}><em>(Optional)</em> Enter a <strong>flight number</strong> if this is an airport trip. The driver will see it on their trip card.</Step>
                        <Step n={6}><em>(Optional)</em> Enter <strong>special instructions</strong> — notes visible only to the assigned driver, e.g. "VIP delegation — display name card on arrival".</Step>
                        <Step n={7}>
                            Review the <strong>"Send booking access link"</strong> toggle:{' '}
                            <strong>ON</strong> (default) sends the client an email with subject <em>"Your SwiftLink booking link"</em>.{' '}
                            <strong>OFF</strong> creates the booking silently for internal trips.
                        </Step>
                        <Step n={8}>Click <strong>"Create Booking"</strong>. The booking appears in <strong>Incoming Bookings</strong> with status <strong>Pending</strong>.</Step>
                        <PrivacyNote>
                            The client's corporate email is used only to deliver their access link and trip notifications. It is never visible to the assigned driver at any point.
                        </PrivacyNote>
                    </div>
                </HelpSection>

                {/* 3 — Assigning a Driver and Vehicle */}
                <HelpSection
                    id="assign" icon="person_add"
                    title="Assigning a Driver and Vehicle"
                    subtitle="Matching a pending booking to a driver and vehicle"
                    expanded={expanded === 'assign'} onToggle={toggle}
                >
                    <div style={{ paddingTop: '16px' }}>
                        <Step n={1}>In the <strong>Incoming Bookings</strong> panel on Dispatch, locate the pending booking card.</Step>
                        <Step n={2}>Review the trip details: client name, route, pickup time, and any special instructions.</Step>
                        <Step n={3}>Select an <strong>available driver</strong> from the driver dropdown.</Step>
                        <Step n={4}>Select a <strong>vehicle</strong> from the vehicle dropdown.</Step>
                        <Step n={5}><em>(Optional)</em> Enter an <strong>ETA</strong> — estimated driver arrival at the pickup point. Shown to the client in their trip view.</Step>
                        <Step n={6}>Click <strong>"Assign"</strong>.</Step>
                        <div style={{ marginTop: '16px', padding: '14px 16px', background: 'rgba(0,0,0,0.03)', borderRadius: '10px' }}>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: '#0D0D0D', marginBottom: '8px' }}>What happens next</div>
                            <ul style={{ margin: 0, paddingLeft: '18px', color: '#3D3D3D', fontSize: '13px', lineHeight: 1.8 }}>
                                <li>Status changes from <strong>Pending → Accepted</strong>.</li>
                                <li>The driver receives a push notification directing them to open the app to view the assignment.</li>
                                <li>
                                    The booking moves to <strong>Awaiting Acceptance</strong>. The timer bar turns{' '}
                                    <strong style={{ color: '#F59E0B' }}>amber after 10 minutes</strong> and{' '}
                                    <strong style={{ color: '#EF4444' }}>red after 20 minutes</strong>.
                                </li>
                                <li>Once the driver accepts, the client receives a push notification with the driver's first name and vehicle details.</li>
                            </ul>
                        </div>
                        <CautionNote>
                            If the timer bar turns red, follow up with the driver directly or reassign to another available driver.
                        </CautionNote>
                    </div>
                </HelpSection>

                {/* 4 — Monitoring Active Trips */}
                <HelpSection
                    id="monitor" icon="near_me"
                    title="Monitoring Active Trips"
                    subtitle="Tracking trips in progress from the Dispatch dashboard"
                    expanded={expanded === 'monitor'} onToggle={toggle}
                >
                    <div style={{ paddingTop: '16px' }}>
                        <DataTable
                            headers={['Panel', 'What it displays']}
                            rows={[
                                ['Active Trips (top widget)', 'In-progress trips — driver name, vehicle reg, force-complete button'],
                                ['Awaiting Acceptance', 'Assigned trips the driver has not yet accepted, with elapsed time bar'],
                                ['Drivers panel', 'All drivers as avatar initials — purple = available, teal = on trip, grey = offline'],
                                ['Fleet Status', 'Vehicles deployed vs total fleet, with a progress bar'],
                                ['Active Trips (bottom grid)', 'Full trip cards — driver, client, route, and complete/confirm controls'],
                            ]}
                        />
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0D0D0D', margin: '16px 0 8px' }}>Force-completing a trip</div>
                        <p style={{ fontSize: '13px', color: '#6B6B6B', margin: '0 0 12px' }}>
                            Use this only when a driver is unreachable and cannot complete the trip themselves.
                        </p>
                        <Step n={1}>In the <strong>Active Trips</strong> panel, locate the trip.</Step>
                        <Step n={2}>Click <strong>"Complete"</strong> on the trip row.</Step>
                        <Step n={3}>A confirm/cancel prompt appears inline — click <strong>"Confirm"</strong> to proceed.</Step>
                        <Step n={4}>The trip is marked completed, both session keys are destroyed, and the client enters a 24-hour complaint window.</Step>
                        <CautionNote>
                            Force-complete is for exceptional cases only. Normally the driver marks trip completion from their own app.
                        </CautionNote>
                    </div>
                </HelpSection>

                {/* 5 — Sessions and Privacy Dashboard */}
                <HelpSection
                    id="privacy" icon="lock"
                    title="Sessions and Privacy Dashboard"
                    subtitle="Understanding ephemeral sessions and the data lifecycle"
                    expanded={expanded === 'privacy'} onToggle={toggle}
                >
                    <div style={{ paddingTop: '16px' }}>
                        <p style={{ fontSize: '14px', color: '#3D3D3D', lineHeight: 1.6, margin: '0 0 14px' }}>
                            Navigate to <strong>Privacy Dashboard</strong> from the pill-nav. When a driver accepts a trip, SwiftLink creates two temporary session keys in Redis — one for the driver, one for the client.
                        </p>
                        <div style={{
                            fontSize: '13px', color: '#3D3D3D', lineHeight: 1.8,
                            paddingLeft: '14px', borderLeft: '2px solid rgba(108,99,255,0.3)',
                            marginBottom: '16px',
                        }}>
                            <div>• Authenticate both parties to the secure chat relay</div>
                            <div>• Define the TTL before session data is automatically deleted</div>
                            <div>• Are destroyed immediately when the driver completes the trip — data cannot be recovered after this point</div>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0D0D0D', marginBottom: '6px' }}>Reading the Session Monitor</div>
                        <DataTable
                            headers={['TTL bar colour', 'Meaning']}
                            rows={[
                                ['🟢 Green', 'More than 50% of session time remaining'],
                                ['🟡 Amber', '25–50% remaining — trip likely nearing completion'],
                                ['🔴 Red', 'Less than 25% remaining — session expiring soon'],
                            ]}
                        />
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0D0D0D', margin: '16px 0 6px' }}>The Audit Log</div>
                        <p style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.6, margin: 0 }}>
                            Every session creation and destruction event is written to the audit log with a timestamp, actor ID, and a SHA-256 destruction hash — cryptographic evidence that the session was properly wiped.
                        </p>
                        <PrivacyNote>
                            This dashboard provides demonstrable evidence of compliance with the data minimisation and storage limitation principles of data protection law. No session data persists beyond trip completion.
                        </PrivacyNote>
                    </div>
                </HelpSection>

                {/* 6 — Managing Complaints */}
                <HelpSection
                    id="complaints" icon="report"
                    title="Managing Complaints"
                    subtitle="Handling client complaints through the investigation lifecycle"
                    expanded={expanded === 'complaints'} onToggle={toggle}
                >
                    <div style={{ paddingTop: '16px' }}>
                        <p style={{ fontSize: '14px', color: '#3D3D3D', margin: '0 0 4px' }}>Navigate to <strong>Complaints</strong> from the pill-nav.</p>
                        <DataTable
                            headers={['Status', 'Meaning']}
                            rows={[
                                ['Open', 'Filed by the client — no investigation started yet'],
                                ['Under Investigation', 'Investigation active — encrypted message archive is accessible'],
                                ['Resolved', 'Investigation complete — no further transitions possible'],
                            ]}
                        />
                        <p style={{ fontSize: '13px', color: '#3D3D3D', margin: '4px 0 12px' }}>
                            Each complaint card has a <strong>status dropdown</strong>. Use it to move the complaint through its lifecycle.
                            The dropdown is disabled once a complaint reaches <strong>Resolved</strong>.
                        </p>
                        <div style={{ fontWeight: 700, fontSize: '14px', color: '#0D0D0D', marginBottom: '10px' }}>Starting an investigation</div>
                        <Step n={1}>Click a complaint row to expand the full detail card.</Step>
                        <Step n={2}>Use the status dropdown to select <strong>"Under Investigation"</strong>.</Step>
                        <Step n={3}>The <strong>"View Messages"</strong> button becomes active — click it to decrypt and read the message archive.</Step>
                        <Step n={4}>Review the conversation between driver and client.</Step>
                        <Step n={5}>Use the <strong>investigation notes</strong> field to record your findings. Notes save automatically when you click away.</Step>
                        <Step n={6}>Click <strong>"Notify Driver"</strong> to formally inform the driver a review is in progress.</Step>
                        <Step n={7}>When complete, use the dropdown to select <strong>"Resolved"</strong>. This cannot be undone.</Step>
                        <p style={{ fontSize: '13px', color: '#3D3D3D', lineHeight: 1.6, marginTop: '12px' }}>
                            <strong>To pause an investigation:</strong> return the status to <strong>Open</strong> using the dropdown.
                            The message archive becomes inaccessible again until you restart.
                        </p>
                        <PrivacyNote>
                            The message archive is AES-256-GCM encrypted at rest and can only be decrypted while the complaint status is Under Investigation. This is enforced at the server level.
                        </PrivacyNote>
                    </div>
                </HelpSection>

                {/* 7 — Compliance and Audit Export */}
                <HelpSection
                    id="audit" icon="download"
                    title="Compliance and Audit Export"
                    subtitle="Generating compliance reports for institutional review"
                    expanded={expanded === 'audit'} onToggle={toggle}
                >
                    <div style={{ paddingTop: '16px' }}>
                        <p style={{ fontSize: '14px', color: '#3D3D3D', margin: '0 0 4px' }}>Navigate to <strong>Audit</strong> from the pill-nav.</p>
                        <DataTable
                            headers={['Export', 'Format', 'Contains']}
                            rows={[
                                ['DPA Compliance Report', 'PDF', 'System overview, session destruction events with timestamps and SHA-256 hashes, data retention summary'],
                                ['Audit Log', 'CSV', 'Every logged action — actor ID, role, action type, target, timestamp, details'],
                            ]}
                        />
                        <Step n={1}>Click <strong>"Export Compliance Report (PDF)"</strong> to generate and download the PDF immediately.</Step>
                        <Step n={2}>Click <strong>"Export Audit Log (CSV)"</strong> to download the raw audit log.</Step>
                        <CautionNote>
                            These exports contain operational and personal data relevant to DPA compliance reviews. Store and transmit them securely.
                        </CautionNote>
                    </div>
                </HelpSection>

            </div>
        </PageWrapper>
    );
}
