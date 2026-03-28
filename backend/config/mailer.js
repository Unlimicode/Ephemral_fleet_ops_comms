import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT),
  secure: false,
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

export const sendEmail = async ({ to, subject, text }) => {
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject,
    text,
  });
};

export default transporter;
