import { apiRequest } from './client';
import type {
  AuthResponse,
  RegisterResponse,
  ResetCodeVerificationResponse,
  UserProfile,
  VerificationStatusResponse,
} from './types';

export async function registerAccount(input: {
  email: string;
  password: string;
  termsConsent: true;
  profilePhotoUri?: string | null;
}): Promise<RegisterResponse> {
  const formData = new FormData();
  formData.append('email', input.email);
  formData.append('password', input.password);
  formData.append('termsConsent', 'true');

  if (input.profilePhotoUri) {
    formData.append('profilePhoto', {
      uri: input.profilePhotoUri,
      name: 'profile.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
  }

  return apiRequest<RegisterResponse>('/auth/register', {
    method: 'POST',
    formData,
    token: null,
    skipAuthRefresh: true,
  });
}

export async function verifyEmailToken(token: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/verify-email', {
    method: 'POST',
    body: { token },
    token: null,
    skipAuthRefresh: true,
  });
}

export async function getVerificationStatus(email: string): Promise<VerificationStatusResponse> {
  return apiRequest<VerificationStatusResponse>(
    `/auth/verification-status?email=${encodeURIComponent(email)}`,
    { token: null, skipAuthRefresh: true },
  );
}

export async function resumeVerifiedSession(pendingSessionToken: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/resume-verified-session', {
    method: 'POST',
    body: { pendingSessionToken },
    token: null,
    skipAuthRefresh: true,
  });
}

export async function resendVerificationEmail(email: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/resend-verification', {
    method: 'POST',
    body: { email },
    token: null,
    skipAuthRefresh: true,
  });
}

export async function loginAccount(email: string, password: string): Promise<AuthResponse> {
  return apiRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: { email, password },
    token: null,
    skipAuthRefresh: true,
  });
}

export async function logoutAccount(refreshToken?: string | null): Promise<void> {
  await apiRequest<{ message: string }>('/auth/logout', {
    method: 'POST',
    body: refreshToken ? { refreshToken } : {},
  });
}

export async function updateProfileNames(givenName: string, surname: string): Promise<UserProfile> {
  return apiRequest<UserProfile>('/auth/profile/names', {
    method: 'PATCH',
    body: { givenName, surname },
  });
}

export async function recordParentalConsent(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/auth/profile/parental-consent', {
    method: 'POST',
    body: { parentalConsent: true },
  });
}

export async function completeRegistration(input: {
  firstName: string;
  lastName: string;
  birthdate: Date;
  gender: string;
  termsConsent: true;
  parentalConsent?: boolean;
}): Promise<UserProfile> {
  return apiRequest<UserProfile>('/auth/profile/complete-registration', {
    method: 'POST',
    body: {
      ...input,
      birthdate: input.birthdate.toISOString(),
    },
  });
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: { email },
    token: null,
    skipAuthRefresh: true,
  });
}

export async function verifyPasswordResetCode(
  email: string,
  code: string,
): Promise<ResetCodeVerificationResponse> {
  return apiRequest<ResetCodeVerificationResponse>('/auth/verify-reset-code', {
    method: 'POST',
    body: { email, code },
    token: null,
    skipAuthRefresh: true,
  });
}

export async function resetPasswordWithToken(
  resetToken: string,
  password: string,
): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: { resetToken, password },
    token: null,
    skipAuthRefresh: true,
  });
}

export async function resendPasswordResetCode(email: string): Promise<{ message: string }> {
  return apiRequest<{ message: string }>('/auth/resend-reset-code', {
    method: 'POST',
    body: { email },
    token: null,
    skipAuthRefresh: true,
  });
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  return apiRequest<UserProfile>('/auth/me');
}
