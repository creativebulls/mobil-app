import fs from 'fs';
import path from 'path';

const TEMPLATE_DIR = path.join(process.cwd(), 'templates', 'emails');

function loadTemplate(filename: string): string {
  const filePath = path.join(TEMPLATE_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Email template not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, 'utf8');
}

function renderTemplate(template: string, variables: Record<string, string | number>): string {
  return Object.entries(variables).reduce((html, [key, value]) => {
    return html.replaceAll(`{{${key}}}`, String(value));
  }, template);
}

export type VerificationEmailContent = {
  html: string;
  text: string;
  verifyUrl: string;
  deepLinkUrl: string;
};

export function buildVerificationEmail(input: {
  userEmail: string;
  verifyUrl: string;
  deepLinkUrl: string;
  expiresHours: number;
}): VerificationEmailContent {
  const html = renderTemplate(loadTemplate('verification-email.html'), {
    userEmail: input.userEmail,
    verifyUrl: input.verifyUrl,
    deepLinkUrl: input.deepLinkUrl,
    expiresHours: input.expiresHours,
    year: new Date().getFullYear(),
  });

  const text = [
    'Verify your CRAVE email',
    '',
    `Hi,`,
    '',
    `Welcome to CRAVE. Please verify ${input.userEmail} to continue registration.`,
    '',
    `Verify your email: ${input.verifyUrl}`,
    '',
    `Or open the app directly: ${input.deepLinkUrl}`,
    '',
    `This link expires in ${input.expiresHours} hours.`,
    '',
    'If you did not create a CRAVE account, you can ignore this email.',
  ].join('\n');

  return {
    html,
    text,
    verifyUrl: input.verifyUrl,
    deepLinkUrl: input.deepLinkUrl,
  };
}

export function buildVerificationSuccessPage(input: {
  userEmail: string;
  deepLinkUrl: string;
}): string {
  return renderTemplate(loadTemplate('verification-success.html'), {
    userEmail: input.userEmail,
    deepLinkUrl: input.deepLinkUrl,
  });
}

export function buildVerificationErrorPage(deepLinkUrl: string): string {
  return renderTemplate(loadTemplate('verification-error.html'), {
    deepLinkUrl,
  });
}

export type PasswordResetEmailContent = {
  html: string;
  text: string;
};

export function buildPasswordResetEmail(input: {
  userEmail: string;
  resetCode: string;
  expiresMinutes: number;
}): PasswordResetEmailContent {
  const html = renderTemplate(loadTemplate('password-reset-email.html'), {
    userEmail: input.userEmail,
    resetCode: input.resetCode,
    expiresMinutes: input.expiresMinutes,
    year: new Date().getFullYear(),
  });

  const text = [
    'Reset your CRAVE password',
    '',
    `We received a request to reset the password for ${input.userEmail}.`,
    '',
    `Your verification code: ${input.resetCode}`,
    '',
    `Enter this code in the CRAVE app to continue.`,
    '',
    `This code expires in ${input.expiresMinutes} minutes.`,
    '',
    'If you did not request a password reset, you can ignore this email.',
  ].join('\n');

  return { html, text };
}
