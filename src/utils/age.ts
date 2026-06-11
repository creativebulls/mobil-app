export function getAge(birthdate: Date, referenceDate: Date = new Date()): number {
  let age = referenceDate.getFullYear() - birthdate.getFullYear();
  const monthDiff = referenceDate.getMonth() - birthdate.getMonth();
  const dayDiff = referenceDate.getDate() - birthdate.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age;
}

export function isUnderAge(birthdate: Date, minimumAge: number, referenceDate: Date = new Date()): boolean {
  return getAge(birthdate, referenceDate) < minimumAge;
}

export const MINIMUM_ACCOUNT_AGE = 16;
