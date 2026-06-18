import { StyleSheet } from 'react-native';

import { colors } from './colors';

export const authStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.white,
  },
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  topSection: {
    position: 'relative',
    minHeight: 120,
    justifyContent: 'center',
  },
  logoWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
  },
  logo: {
    width: 112,
    height: 112,
  },
  lockIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.inputGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkEmailContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  checkEmailHeading: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    textAlign: 'center',
    marginTop: 8,
  },
  checkEmailSubtext: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  checkEmailAddress: {
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
  },
  checkEmailHint: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.labelGray,
    textAlign: 'center',
    marginTop: 4,
  },
  checkEmailFooterLinkWrap: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    alignItems: 'center',
  },
  checkEmailFooterLink: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.brand,
    textAlign: 'center',
  },
  checkEmailContinueButton: {
    marginTop: 16,
    alignSelf: 'stretch',
    width: '100%',
  },
  headerSubtitle: {
    fontSize: 18,
    lineHeight: 26,
    color: '#000000',
    fontWeight: '500',
    textAlign: 'left',
    paddingHorizontal: 24,
    marginTop: 20,
    marginBottom: 24,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  form: {
    gap: 20,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.labelGray,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '600',
  },
  successText: {
    fontSize: 14,
    color: '#16A34A',
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  footerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.brand,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  linkMuted: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.labelGray,
  },
});
