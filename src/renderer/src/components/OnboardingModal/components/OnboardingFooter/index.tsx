import React from 'react';
import { Button } from '@renderer/components/Button';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { BackIcon, ForwardIcon } from '@renderer/styles/icons';
import styles from './styles.module.css';

interface Props {
  onSkip?: () => void;
  onBack?: () => void;
  onContinue?: () => void;
  submit?: boolean;
  loading?: boolean;
  disabled?: boolean;
  finish?: boolean;
}

export const OnboardingFooter = ({
  onSkip,
  onBack,
  onContinue,
  submit,
  loading,
  disabled,
  finish,
}: Props) => {
  const t = useI18nStore((state) => state.t);
  const colors = useThemeStore((state) => state.activeTheme.modal);
  const busy = disabled || loading;

  return (
    <footer
      className={styles.footer}
      style={{ backgroundColor: colors.backgroundColor, borderColor: colors.borderColor }}
    >
      <Row>
        {!finish && onSkip && (
          <Button
            xs={12}
            sm={3}
            text
            className={styles.button}
            onClick={onSkip}
            disabled={busy}
            color={colors.color}
            justifyContent="start"
          >
            {t('onboarding.skip')}
          </Button>
        )}
        <Spacer />
        {onBack && (
          <Button
            xs={6}
            sm={3}
            className={styles.button}
            onClick={onBack}
            disabled={busy}
            color={colors.neutralButtonColor || colors.color}
            backgroundColor={colors.neutralButtonBackgroundColor || colors.fieldBackgroundColor}
            icon={() => <BackIcon size={16} aria-hidden="true" />}
            iconPosition="before"
          >
            {t('onboarding.back')}
          </Button>
        )}
        <Button
          xs={finish ? 12 : 6}
          sm={finish ? 4 : 3}
          className={styles.button}
          type={submit ? 'submit' : 'button'}
          onClick={onContinue}
          loading={loading}
          disabled={disabled}
          color={colors.saveButtonColor}
          backgroundColor={colors.saveButtonBackgroundColor}
          icon={() => <ForwardIcon size={16} aria-hidden="true" />}
        >
          {t(finish ? 'onboarding.finish' : 'onboarding.continue')}
        </Button>
      </Row>
    </footer>
  );
};
