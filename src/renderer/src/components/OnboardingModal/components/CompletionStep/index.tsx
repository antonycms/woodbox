import React from 'react';
import { Text } from '@renderer/components/Text';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { IconDatabase } from '@renderer/styles/icons';
import { OnboardingFooter } from '../OnboardingFooter';
import styles from './styles.module.css';

interface Props {
  projectName: string;
  onFinish: () => void;
}

export const CompletionStep = ({ projectName, onFinish }: Props) => {
  const t = useI18nStore((state) => state.t);
  const colors = useThemeStore((state) => state.activeTheme.modal);

  return (
    <>
      <div className={styles.summary}>
        <IconDatabase size={28} color={colors.saveButtonBackgroundColor} aria-hidden="true" />
        <Text bold userSelect={false} color={colors.color}>
          {projectName}
        </Text>
        <Text userSelect={false} color={colors.color} className={styles.help}>
          {t('onboarding.done.help')}
        </Text>
      </div>
      <OnboardingFooter onContinue={onFinish} finish />
    </>
  );
};
