import { StyleSheet } from 'react-native';

import { colors } from './colors';

export const formStyles = StyleSheet.create({
  form: {
    gap: 20,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textOnGradient,
  },
  labelLight: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.labelGray,
  },
  input: {
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.inputBackground,
  },
  errorText: {
    fontSize: 14,
    color: '#FEE2E2',
    fontWeight: '600',
  },
  successText: {
    fontSize: 14,
    color: '#DCFCE7',
    fontWeight: '600',
  },
  infoText: {
    fontSize: 14,
    color: '#DCFCE7',
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
    color: 'rgba(255, 255, 255, 0.85)',
  },
  footerLink: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textOnGradient,
  },
  link: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textOnGradient,
  },
});
