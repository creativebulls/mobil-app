export const colors = {
  white: '#FFFFFF',
  background: '#F1FAFC',
  primary: '#52BAD7',
  primaryLight: '#7FCEE3',
  primaryDark: '#3A97B3',
  accent: '#52BAD7',
  accentSoft: '#BBE4EF',
  text: '#15323B',
  textSecondary: '#5C7782',
  textOnGradient: '#FFFFFF',
  border: '#D2E8EF',
  dotInactive: 'rgba(255, 255, 255, 0.45)',
  dotActive: '#FFFFFF',
  card: 'rgba(255, 255, 255, 0.92)',
  inputBackground: 'rgba(255, 255, 255, 0.95)',
  inputGray: '#F2F2F2',
  facebook: '#1877F2',
  buttonPurple: '#52BAD7',
  buttonDisabled: '#E5E5E5',
  labelGray: '#9CA3AF',
  inputFocus: '#52BAD7',
  brand: '#52BAD7',
  buttonActive: '#52BAD7',
  danger: '#E5484D',
};

type GradientConfig = {
  colors: readonly [string, string, ...string[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
};

export const gradients: Record<string, GradientConfig> = {
  screen: {
    colors: ['#52BAD7', '#2E8FB0'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  screenSoft: {
    colors: ['#E8F6FB', '#D5EEF5'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  button: {
    colors: ['#52BAD7', '#2E8FB0'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  card: {
    colors: ['#52BAD7', '#2E8FB0'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  illustration: {
    colors: ['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0.12)'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
};
