import { Router } from 'express';

import * as authController from './auth.controller';

export const authRouter = Router();

authRouter.post('/register', authController.registerMiddleware, authController.register);
authRouter.post('/verify-email', authController.verifyEmail);
authRouter.get('/verify-email/:token/confirm', authController.verifyEmailConfirm);
authRouter.post('/resume-verified-session', authController.resumeVerifiedSession);
authRouter.get('/verification-status', authController.verificationStatus);
authRouter.post('/resend-verification', authController.resendVerification);
authRouter.post('/login', authController.login);
authRouter.post('/apple', authController.loginWithApple);
authRouter.post('/google', authController.loginWithGoogle);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.authGuards[0], authController.logout);
authRouter.post('/forgot-password', authController.forgotPassword);
authRouter.post('/verify-reset-code', authController.verifyResetCode);
authRouter.post('/reset-password', authController.resetPassword);
authRouter.post('/resend-reset-code', authController.resendResetCode);

authRouter.get('/me', authController.authGuards[0], authController.me);
authRouter.patch('/profile/names', ...authController.authGuards, authController.updateNames);
authRouter.post(
  '/profile/photo',
  ...authController.authGuards,
  authController.uploadPhotoMiddleware,
  authController.uploadProfilePhoto,
);
authRouter.post(
  '/profile/parental-consent',
  ...authController.authGuards,
  authController.recordParentalConsent,
);
authRouter.post(
  '/profile/complete-registration',
  ...authController.authGuards,
  authController.completeRegistration,
);
