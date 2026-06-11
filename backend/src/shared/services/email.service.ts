import nodemailer from 'nodemailer';

import { env, isDevelopment } from '../../config/env';
import {
  buildPasswordResetEmail,
  buildVerificationEmail,
  buildVerificationErrorPage,
  buildVerificationSuccessPage,
} from '../../templates/emailTemplates';

const VERIFICATION_EXPIRES_HOURS = 24;
const RESET_CODE_EXPIRES_MINUTES = 10;

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT ?? 587,
      secure: false,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : undefined,
    })
  : null;

async function deliverMail(options: {
  to: string;
  subject: string;
  text: string;
  html: string;
}): Promise<void> {
  if (!transporter) {
    console.info('\n[email:dev]', options.subject);
    console.info(`To: ${options.to}`);
    console.info(options.text);
    console.info('---\n');
    return;
  }

  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  });

  if (isDevelopment) {
    console.info(`[email] Sent to ${options.to} via ${env.SMTP_HOST}:${env.SMTP_PORT ?? 587}`);
    if (env.SMTP_PORT === 1025) {
      console.info('[email] View in Mailpit: http://localhost:8025');
    }
  }
}

export function getVerificationLinks(token: string) {
  const verifyUrl = `${env.APP_URL}/api/v1/auth/verify-email/${token}/confirm`;
  const deepLinkUrl = `${env.MOBILE_DEEP_LINK_SCHEME}://email-verified?token=${encodeURIComponent(token)}`;

  return { verifyUrl, deepLinkUrl };
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const { verifyUrl, deepLinkUrl } = getVerificationLinks(token);

  const content = buildVerificationEmail({
    userEmail: email,
    verifyUrl,
    deepLinkUrl,
    expiresHours: VERIFICATION_EXPIRES_HOURS,
  });

  await deliverMail({
    to: email,
    subject: 'Verify your WhereAbout email',
    text: content.text,
    html: content.html,
  });

  if (isDevelopment) {
    console.info('[email] Verification link:', verifyUrl);
    console.info('[email] App deep link:', deepLinkUrl);
  }
}

export function getEmailVerifiedDeepLink(verifiedOnly = false, token?: string): string {
  if (verifiedOnly) {
    return `${env.MOBILE_DEEP_LINK_SCHEME}://email-verified?verified=1`;
  }

  if (token) {
    return `${env.MOBILE_DEEP_LINK_SCHEME}://email-verified?token=${encodeURIComponent(token)}`;
  }

  return `${env.MOBILE_DEEP_LINK_SCHEME}://email-verified?verified=1`;
}

export function renderVerificationSuccessPage(email: string): string {
  return buildVerificationSuccessPage({
    userEmail: email,
    deepLinkUrl: getEmailVerifiedDeepLink(true),
  });
}

export function renderVerificationErrorPage(): string {
  return buildVerificationErrorPage(getEmailVerifiedDeepLink(true));
}

export async function sendPasswordResetCode(email: string, code: string): Promise<void> {
  await deliverMail({
    to: email,
    subject: 'Your WhereAbout password reset code',
    text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
        <div style="height:4px;background:linear-gradient(90deg,#9447B3,#F36464);border-radius:4px;margin-bottom:24px;"></div>
        <h2 style="color:#2D1A35;margin:0 0 12px;">Password reset code</h2>
        <p style="color:#7A6288;line-height:1.6;">Use this code to reset your WhereAbout password:</p>
        <p style="font-size:32px;font-weight:800;letter-spacing:8px;color:#F36464;margin:24px 0;">${code}</p>
        <p style="color:#9CA3AF;font-size:14px;">This code expires in 10 minutes.</p>
      </div>
    `,
  });
}
