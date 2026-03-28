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

export default client;
