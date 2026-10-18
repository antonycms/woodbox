import { IconSettings, IconFolder, IconDatabase } from '@renderer/styles/icons';

export const onboardingSteps = [
  { id: 'preferences', Icon: IconSettings },
  { id: 'project', Icon: IconFolder },
  { id: 'connection', Icon: IconDatabase },
] as const;

export type OnboardingStep = (typeof onboardingSteps)[number]['id'] | 'done';
