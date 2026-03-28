import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 'test_placeholder');

export const sendEmail = async ({ to, subject, text }) => {
  const { error } = await resend.emails.send({
    from: process.env.MAIL_FROM || 'SwiftLink <onboarding@resend.dev>',
    to,
    subject,
    text,
  });
  if (error) throw new Error(error.message);
};

export default resend;
