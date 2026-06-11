let profilePhotoUri: string | null = null;
let email = '';
let password = '';
let givenName = '';
let surname = '';
let birthdateIso: string | null = null;
let gender = '';
let parentalConsent = false;

export function setSignUpDraft(data: {
  profilePhotoUri: string | null;
  email: string;
  password: string;
}) {
  profilePhotoUri = data.profilePhotoUri;
  email = data.email;
  password = data.password;
}

export function setSignUpName(data: { name: string; surname: string }) {
  givenName = data.name;
  surname = data.surname;
}

export function setSignUpProfilePhoto(uri: string | null) {
  profilePhotoUri = uri;
}

export function setSignUpRegistrationDetails(data: { birthdate: Date; gender: string }) {
  birthdateIso = data.birthdate.toISOString();
  gender = data.gender;
}

export function setSignUpParentalConsent(value: boolean) {
  parentalConsent = value;
}

export function getSignUpProfilePhoto() {
  return profilePhotoUri;
}

export function getSignUpEmail() {
  return email;
}

export function getSignUpPassword() {
  return password;
}

export function getSignUpGivenName() {
  return givenName;
}

export function getSignUpSurname() {
  return surname;
}

export function getSignUpBirthdate() {
  return birthdateIso ? new Date(birthdateIso) : null;
}

export function getSignUpGender() {
  return gender;
}

export function getSignUpParentalConsent() {
  return parentalConsent;
}

export function clearSignUpDraft() {
  profilePhotoUri = null;
  email = '';
  password = '';
  givenName = '';
  surname = '';
  birthdateIso = null;
  gender = '';
  parentalConsent = false;
}
