export const colors = {
  white: '#FFFFFF',
  background: '#FAF5FC',
  primary: '#9447B3',
  primaryLight: '#B06BC9',
  primaryDark: '#7A3A96',
  accent: '#F26A41',
  accentSoft: '#F5C4B8',
  text: '#2D1A35',
  textSecondary: '#7A6288',
  textOnGradient: '#FFFFFF',
  border: '#E8D0F0',
  dotInactive: 'rgba(255, 255, 255, 0.45)',
  dotActive: '#FFFFFF',
  card: 'rgba(255, 255, 255, 0.92)',
  inputBackground: 'rgba(255, 255, 255, 0.95)',
  inputGray: '#F2F2F2',
  facebook: '#1877F2',
  buttonPurple: '#5E36E1',
  buttonDisabled: '#E5E5E5',
  labelGray: '#9CA3AF',
  inputFocus: '#F36464',
  brand: '#F36464',
  buttonActive: '#F36464',
  danger: '#E5484D',
};

type GradientConfig = {
  colors: readonly [string, string, ...string[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
};

export const gradients: Record<string, GradientConfig> = {
  screen: {
    colors: ['#9447B3', '#F26A41'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  screenSoft: {
    colors: ['#F3E8F8', '#FDEAE3'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  button: {
    colors: ['#9447B3', '#F26A41'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  card: {
    colors: ['#9447B3', '#F26A41'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  illustration: {
    colors: ['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0.12)'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
};
