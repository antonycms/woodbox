import React from 'react';
import { ConnectionForm } from '@renderer/components/ConnectionForm';
import { Button } from '@renderer/components/Button';
import { Row } from '@renderer/components/Grid';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { OnboardingFooter } from '../OnboardingFooter';

interface Props {
  active: boolean;
  idProject: string;
  onSaved: () => void;
  onSkip: () => void;
  onBack: () => void;
}

export const ConnectionStep = ({ active, idProject, onSaved, onSkip, onBack }: Props) => {
  const t = useI18nStore((state) => state.t);
  const colors = useThemeStore((state) => state.activeTheme.modal);

  return (
    <div hidden={!active}>
      <ConnectionForm
        idProject={idProject}
        onSaved={onSaved}
        renderActions={({ testConnection, testing, saving }) => (
          <>
            <Row>
              <Button
                xs={6}
                sm={4}
                md={3}
                onClick={testConnection}
                loading={testing}
                disabled={saving}
                color={colors.testButtonColor}
                backgroundColor={colors.testButtonBackgroundColor}
              >
                {t('common.test')}
              </Button>
            </Row>
            <OnboardingFooter
              onSkip={onSkip}
              onBack={onBack}
              disabled={testing}
              loading={saving}
              submit
            />
          </>
        )}
      />
    </div>
  );
};
