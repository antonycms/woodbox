import React from 'react';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { classes } from '@renderer/styles/theme';
import { onboardingSteps, type OnboardingStep } from '../../constants';
import styles from './styles.module.css';

interface Props {
  step: OnboardingStep;
  titleId: string;
}

export const OnboardingHeader = ({ step, titleId }: Props) => {
  const t = useI18nStore((state) => state.t);
  const colors = useThemeStore((state) => state.activeTheme.modal);
  const activeIndex =
    step === 'done'
      ? onboardingSteps.length
      : onboardingSteps.findIndex((item) => item.id === step);

  return (
    <header
      className={styles.header}
      style={
        {
          '--onboarding-muted': colors.mutedColor,
          '--onboarding-border': colors.borderColor,
          '--onboarding-accent': colors.saveButtonBackgroundColor,
        } as React.CSSProperties
      }
    >
      <span className={styles.welcome}>{t('onboarding.welcome')}</span>
      <ol className={styles.steps} aria-label={t('onboarding.progress')}>
        {onboardingSteps.map(({ id, Icon }, index) => (
          <li
            key={id}
            className={classes(styles.step, index <= activeIndex && styles.activeStep)}
            aria-current={id === step ? 'step' : undefined}
          >
            <Icon size={16} aria-hidden="true" />
            <span>{t(`onboarding.${id}.label`)}</span>
          </li>
        ))}
      </ol>
      <h1 id={titleId} className={styles.title}>
        {t(`onboarding.${step}.title`)}
      </h1>
      <p className={styles.description}>{t(`onboarding.${step}.description`)}</p>
    </header>
  );
};
