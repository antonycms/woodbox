import React from 'react';
import { Modal } from '@renderer/components/Modal';
import { useThemeStore } from '@renderer/stores/Theme';
import { OnboardingHeader } from './components/OnboardingHeader';
import { PreferencesStep } from './components/PreferencesStep';
import { ProjectStep } from './components/ProjectStep';
import { ConnectionStep } from './components/ConnectionStep';
import { CompletionStep } from './components/CompletionStep';
import { useOnboarding } from './hooks/useOnboarding';
import styles from './styles.module.css';

// Mounted only after the initial stores have loaded successfully.
export const OnboardingModal = () => {
  const colors = useThemeStore((state) => state.activeTheme.modal);
  const { show, step, project, dialogRef, titleId, close, setStep, onProjectSaved, trapFocus } =
    useOnboarding();

  return (
    <Modal show={show} width="min(760px, calc(100vw - 32px))" maxHeight="90vh">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={trapFocus}
        className={styles.layout}
        style={{ color: colors.color }}
      >
        <OnboardingHeader step={step} titleId={titleId} />
        {step === 'preferences' && (
          <PreferencesStep onSkip={close} onContinue={() => setStep('project')} />
        )}
        {step === 'project' && (
          <ProjectStep
            project={project}
            onSkip={close}
            onBack={() => setStep('preferences')}
            onSaved={onProjectSaved}
          />
        )}
        {project && step !== 'done' && (
          <ConnectionStep
            active={step === 'connection'}
            idProject={project.id}
            onSaved={() => setStep('done')}
            onSkip={close}
            onBack={() => setStep('project')}
          />
        )}
        {step === 'done' && (
          <CompletionStep projectName={project?.description || ''} onFinish={close} />
        )}
      </div>
    </Modal>
  );
};
