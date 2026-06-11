export type RegistrationSlideInfo = {
  id: number;
  stepLabel: string;
  title: string;
  subtitle: string;
};

export const REGISTRATION_SLIDES: RegistrationSlideInfo[] = [
  {
    id: 0,
    stepLabel: '',
    title: 'What\'s Your Name?',
    subtitle: 'Let others know who you are on the platform',
  },
  {
    id: 1,
    stepLabel: '',
    title: 'Enter birthday and gender',
    subtitle: '',
  },
  {
    id: 2,
    stepLabel: '',
    title: 'Review & Consent',
    subtitle: 'Confirm your details to finish registration',
  },
];
