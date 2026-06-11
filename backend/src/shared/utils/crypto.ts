import crypto from 'crypto';

export function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function generateNumericCode(length = 6): string {
  const max = 10 ** length;
  const code = crypto.randomInt(0, max);
  return code.toString().padStart(length, '0');
}

export function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function calculateAge(birthdate: Date, referenceDate = new Date()): number {
  let age = referenceDate.getFullYear() - birthdate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthdate.getMonth();
  const dayDiff = referenceDate.getDate() - birthdate.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age;
}
