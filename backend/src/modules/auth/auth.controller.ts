import { Response } from 'express';

import {
  requireAuth,
  requireVerifiedEmail,
  type AuthenticatedRequest,
} from '../../shared/middleware/auth.middleware';
import { AppError } from '../../shared/errors/AppError';
import {
  renderVerificationErrorPage,
  renderVerificationSuccessPage,
} from '../../shared/services/email.service';
import { profilePhotoUpload } from '../../shared/middleware/upload.middleware';
import { asyncHandler, sendSuccess } from '../../shared/utils/http';
import {
  completeRegistrationSchema,
  forgotPasswordSchema,
  loginSchema,
  parentalConsentSchema,
  refreshTokenSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  resumeVerifiedSessionSchema,
  updateNamesSchema,
  verifyEmailSchema,
  verifyResetCodeSchema,
} from './auth.validation';
import * as authService from './auth.service';

export const register = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = registerSchema.parse({
    email: req.body.email,
    password: req.body.password,
    termsConsent: req.body.termsConsent === true || req.body.termsConsent === 'true',
  });
  const profilePhotoUrl = req.file
    ? authService.resolveUploadedPhotoUrl(req.file.filename)
    : undefined;

  const result = await authService.registerUser({
    ...body,
    profilePhotoUrl,
  });

  sendSuccess(res, result, 201);
});

export const verifyEmail = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { token } = verifyEmailSchema.parse({
    token: req.body.token ?? req.params.token,
  });
  const result = await authService.verifyEmail(token);
  sendSuccess(res, result);
});

export const verifyEmailConfirm = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const { token } = verifyEmailSchema.parse({ token: req.params.token });

  try {
    const result = await authService.verifyEmail(token);
    res.type('html').send(renderVerificationSuccessPage(result.user.email));
  } catch (error) {
    if (error instanceof AppError && error.code === 'INVALID_VERIFICATION_TOKEN') {
      res.status(400).type('html').send(renderVerificationErrorPage());
      return;
    }

    throw error;
  }
});

export const resumeVerifiedSession = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = resumeVerifiedSessionSchema.parse(req.body);
  const result = await authService.resumeVerifiedSession(body.pendingSessionToken);
  sendSuccess(res, result);
});

export const verificationStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const email = String(req.query.email ?? '');

  if (!email) {
    res.status(422).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Email query parameter is required' },
    });
    return;
  }

  const result = await authService.getVerificationStatus(email);
  sendSuccess(res, result);
});

export const resendVerification = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = resendVerificationSchema.parse(req.body);
  const result = await authService.resendVerificationEmail(body.email);
  sendSuccess(res, result);
});

export const login = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = loginSchema.parse(req.body);
  const result = await authService.loginUser(body.email, body.password);
  sendSuccess(res, result);
});

export const refresh = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = refreshTokenSchema.parse(req.body);
  const result = await authService.refreshSession(body.refreshToken);
  sendSuccess(res, result);
});

export const logout = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const refreshToken = typeof req.body.refreshToken === 'string' ? req.body.refreshToken : undefined;
  const result = await authService.logoutUser(req.auth!.userId, refreshToken);
  sendSuccess(res, result);
});

export const forgotPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = forgotPasswordSchema.parse(req.body);
  const result = await authService.requestPasswordReset(body.email);
  sendSuccess(res, result);
});

export const verifyResetCode = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = verifyResetCodeSchema.parse(req.body);
  const result = await authService.verifyPasswordResetCode(body.email, body.code);
  sendSuccess(res, result);
});

export const resetPassword = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = resetPasswordSchema.parse(req.body);
  const result = await authService.resetPassword(body.resetToken, body.password);
  sendSuccess(res, result);
});

export const resendResetCode = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = forgotPasswordSchema.parse(req.body);
  const result = await authService.resendPasswordResetCode(body.email);
  sendSuccess(res, result);
});

export const me = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const result = await authService.getCurrentUser(req.auth!.userId);
  sendSuccess(res, result);
});

export const updateNames = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = updateNamesSchema.parse(req.body);
  const result = await authService.updateProfileNames(req.auth!.userId, body.givenName, body.surname);
  sendSuccess(res, result);
});

export const recordParentalConsent = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  parentalConsentSchema.parse(req.body);
  const result = await authService.setParentalConsent(req.auth!.userId);
  sendSuccess(res, result);
});

export const completeRegistration = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const body = completeRegistrationSchema.parse(req.body);
  const result = await authService.completeRegistration(req.auth!.userId, body);
  sendSuccess(res, result);
});

export const uploadProfilePhoto = asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    res.status(422).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Profile photo file is required' },
    });
    return;
  }

  const result = await authService.updateProfilePhoto(req.auth!.userId, req.file.filename);
  sendSuccess(res, result);
});

export const registerMiddleware = profilePhotoUpload.single('profilePhoto');
export const uploadPhotoMiddleware = profilePhotoUpload.single('profilePhoto');
export const authGuards = [requireAuth, requireVerifiedEmail];
