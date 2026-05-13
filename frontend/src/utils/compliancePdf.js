import jsPDF from 'jspdf';

/**
 * Generates and downloads the full 9-section SwiftLink compliance PDF.
 * Accepts the raw JSON response from GET /api/dashboard/compliance-report.
 */
export function generateCompliancePDF(report) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin       = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    const checkPage = (needed = 12) => {
        if (y + needed > pageHeight - 16) { doc.addPage(); y = 20; }
    };

    const addText = (text, x, fontSize, color, bold = false) => {
        doc.setFontSize(fontSize);
        doc.setTextColor(...color);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        const lines = doc.splitTextToSize(String(text ?? ''), contentWidth - (x - margin));
        checkPage(lines.length * (fontSize * 0.4) + 4);
        doc.text(lines, x, y);
        y += lines.length * (fontSize * 0.4) + 4;
    };

    const addDivider = (color = [108, 99, 255], weight = 0.5) => {
        checkPage(8);
        doc.setDrawColor(...color);
        doc.setLineWidth(weight);
        doc.line(margin, y, pageWidth - margin, y);
        y += 8;
    };

    const addMetricRow = (label, value, highlight = false) => {
        checkPage(8);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 107, 107);
        doc.text(label, margin, y);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...(highlight ? [0, 160, 100] : [13, 13, 13]));
        doc.text(String(value ?? 'N/A'), pageWidth - margin, y, { align: 'right' });
        y += 8;
    };

    const c  = report.compliance  || {};
    const s  = report.sections    || {};
    const s3 = s.session_lifecycle        || {};
    const s6 = s.complaint_investigation  || {};

    // ── 1. HEADER ────────────────────────────────────────────────────
    addText('SwiftLink Compliance Report', margin, 22, [13, 13, 13], true);
    addText('Mediated Ephemeral Identity Framework — Data Minimisation Evidence', margin, 11, [107, 107, 107]);
    addText(`Generated: ${new Date(report.generated_at).toLocaleString()}`, margin, 10, [107, 107, 107]);
    addText(`Operator: ${report.operator}`, margin, 10, [107, 107, 107]);
    if (c.period_from) {
        addText(`Period: ${c.period_from} to ${c.period_to || 'present'}`, margin, 10, [107, 107, 107]);
    }
    y += 2;
    addDivider();

    // ── 2. EXECUTIVE SUMMARY ─────────────────────────────────────────
    addText('2. Executive Summary', margin, 14, [13, 13, 13], true);
    y += 2;
    const summary = report.headline?.summary ||
        `In the period covered by this report, SwiftLink processed ${c.sessions_created ?? 0} dispatch sessions. ` +
        `${c.credentials_revoked ?? 0} driver credentials were revoked on trip completion, achieving a data ` +
        `data confinement rate of ${c.minimization_rate_percent ?? 0}%. ` +
        `${c.data_expired ?? 0} sessions resulted in permanent data deletion. ` +
        `${c.data_conditionally_persisted ?? 0} sessions triggered conditional preservation due to filed complaints.`;
    addText(summary, margin, 10, [60, 60, 60]);
    y += 2;
    addDivider([200, 200, 210], 0.3);

    // ── 3. SESSION LIFECYCLE ─────────────────────────────────────────
    addText('3. Session Lifecycle', margin, 14, [13, 13, 13], true);
    y += 2;
    addMetricRow('Sessions Created', c.sessions_created ?? 0);
    addMetricRow('Driver Credentials Issued', c.credentials_issued ?? 0);
    addMetricRow('Driver Credentials Revoked', c.credentials_revoked ?? 0);
    if (s3.avg_session_duration_minutes != null) {
        addMetricRow('Average Session Duration (min)', s3.avg_session_duration_minutes);
    }
    addMetricRow('Active Complaint Windows (live)', c.active_complaint_windows ?? 0);
    y += 2;
    addDivider([200, 200, 210], 0.3);

    // ── 4. DATA LIFECYCLE ────────────────────────────────────────────
    addText('4. Data Lifecycle', margin, 14, [13, 13, 13], true);
    y += 2;
    addMetricRow('Completed Trips', (c.data_expired ?? 0) + (c.data_conditionally_persisted ?? 0));
    addMetricRow('Data Wiped Naturally (TTL expired, no complaint)', c.complaint_window_expirations ?? c.data_expired ?? 0, true);
    addMetricRow('Data Conditionally Preserved (complaint filed)', c.data_conditionally_persisted ?? 0);
    addMetricRow('Complaint Window Expirations', c.complaint_window_expirations ?? 0);
    y += 2;
    checkPage(14);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(108, 99, 255);
    doc.text(`Data Confinement Rate: ${c.minimization_rate_percent ?? 0}%`, margin, y);
    y += 12;
    addDivider([200, 200, 210], 0.3);

    // ── 5. COMMUNICATION ANONYMISATION ───────────────────────────────
    addText('5. Communication Anonymisation', margin, 14, [13, 13, 13], true);
    y += 2;
    addText(
        'All driver-client communication was relayed through the SwiftLink server. At no point were client phone ' +
        'numbers, email addresses, or surnames transmitted to drivers. Drivers received only the client\'s first ' +
        'name and pickup coordinates for operational purposes. This constraint is enforced architecturally — the ' +
        'system has no code path to transmit client identifiers to drivers.',
        margin, 10, [60, 60, 60]
    );
    y += 2;
    addDivider([200, 200, 210], 0.3);

    // ── 6. COMPLAINT & INVESTIGATION ─────────────────────────────────
    addText('6. Complaint & Investigation', margin, 14, [13, 13, 13], true);
    y += 2;
    addMetricRow('Complaints Filed', c.complaints_filed ?? 0);
    addMetricRow('Complaint Filing Rate', `${c.complaint_filing_rate_percent ?? 0}%`);
    addMetricRow('Manager Message-Access Events', c.manager_message_access_events ?? 0);
    if (s6.by_status) {
        addMetricRow('  Open', s6.by_status.open ?? 0);
        addMetricRow('  Under Investigation', s6.by_status.under_investigation ?? 0);
        addMetricRow('  Resolved', s6.by_status.resolved ?? 0);
    }
    y += 2;
    addDivider([200, 200, 210], 0.3);

    // ── 7. AUDIT TRAIL ───────────────────────────────────────────────
    addText('7. Audit Trail', margin, 14, [13, 13, 13], true);
    y += 2;
    addMetricRow('Total Audit Entries', c.audit_entries ?? 0);
    y += 2;
    addText(
        'The audit trail is append-only. No entries have been deleted or modified. All critical system events are ' +
        'recorded with actor identity, timestamp, and action type.',
        margin, 9, [107, 107, 107]
    );
    y += 2;
    addDivider([200, 200, 210], 0.3);

    // ── 8. REGULATORY COMPLIANCE STATEMENT ──────────────────────────
    addText('8. Regulatory Compliance Statement', margin, 14, [13, 13, 13], true);
    y += 2;
    const regText =
        'This report documents compliance with the Kenya Data Protection Act 2019, Section 25 (Data Minimisation ' +
        'Principle). SwiftLink enforces data confinement at the architectural level — communication data is ' +
        'structurally bounded to the trip lifecycle through time-limited Redis sessions, automatic credential ' +
        'revocation, and conditional persistence triggered exclusively by filed complaints. Data cannot escape ' +
        'its trip boundary by design. The metrics above constitute a documented record of data confinement in ' +
        'practice, suitable for presentation to the Office of the Data Protection Commissioner.';
    const regLines = doc.splitTextToSize(regText, contentWidth - 8);
    const boxH = regLines.length * 4.5 + 10;
    checkPage(boxH + 6);
    doc.setDrawColor(180, 180, 210);
    doc.setLineWidth(0.5);
    doc.rect(margin, y - 2, contentWidth, boxH);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50, 50, 80);
    doc.text(regLines, margin + 4, y + 4);
    y += boxH + 6;
    addDivider([200, 200, 210], 0.3);

    // ── 9. ARCHITECTURE NOTE ─────────────────────────────────────────
    addText('9. Architecture Note', margin, 14, [13, 13, 13], true);
    y += 2;
    const archNote = report.architecture_note ||
        s.communication_anonymization?.architectural_note ||
        'These controls are architectural constraints, not policy-layer mitigations.';
    addText(archNote, margin, 10, [60, 60, 60]);
    y += 4;
    if (report.regulatory_basis) {
        addText(report.regulatory_basis, margin, 9, [107, 107, 107]);
    }

    // ── FOOTER ───────────────────────────────────────────────────────
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(160, 160, 160);
        doc.text('Generated by SwiftLink — Confidential', margin, pageHeight - 8);
        doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 8, { align: 'right' });
    }

    doc.save(`swiftlink-compliance-${new Date().toISOString().split('T')[0]}.pdf`);
}
