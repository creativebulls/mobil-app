export type OnboardingSlide = {
  id: string;
  title: string;
  description: string;
};

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: '1',
    title: 'Onboarding Title One',
    description:
      'Connect with friends, share moments, and discover what matters to you in one place.',
  },
  {
    id: '2',
    title: 'Onboarding Title Two',
    description:
      'Stay updated with real-time notifications and explore content tailored just for you.',
  },
];

export const ONBOARDING_STORAGE_KEY = '@onboarding_completed';
