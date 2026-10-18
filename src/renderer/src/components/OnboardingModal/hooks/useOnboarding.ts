import React from 'react';
import type { IProject } from '@shared/types/workspace';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { useI18nStore } from '@renderer/stores/I18n';
import { useToastStore } from '@renderer/stores/Toast';
import { readStorageValue, writeStorageValue } from '@renderer/utils/storage';
import type { OnboardingStep } from '../constants';

const storageKey = '@onboarding:seen';

export const useOnboarding = () => {
  const t = useI18nStore((state) => state.t);
  const showToast = useToastStore((state) => state.showToast);
  // Eligibility is checked once, after the stores finish loading.
  const [show, setShow] = React.useState(
    () =>
      useWorkspaceStore.getState().projects.length === 0 &&
      readStorageValue<unknown>(storageKey, false) !== true,
  );
  const [step, setStep] = React.useState<OnboardingStep>('preferences');
  const [project, setProject] = React.useState<IProject>();
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const titleId = React.useId();

  const close = () => {
    if (!writeStorageValue(storageKey, true)) {
      showToast({ type: 'error', title: t('onboarding.persistenceError') });
      return;
    }
    setShow(false);
  };

  const onProjectSaved = (saved: IProject) => {
    setProject(saved);
    setStep('connection');
  };

  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || event.defaultPrevented) return;
    const elements = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled):not([tabindex="-1"]), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]:not(:disabled)',
      ) || [],
    ).filter((element) => element.getClientRects().length > 0);
    const first = elements[0];
    const last = elements[elements.length - 1];
    if (!first) {
      event.preventDefault();
      dialogRef.current?.focus();
    } else if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === dialogRef.current)
    ) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  React.useEffect(() => {
    // Existing users should not see the tour after deleting their projects either.
    if (useWorkspaceStore.getState().projects.length > 0) writeStorageValue(storageKey, true);
  }, []);

  React.useEffect(() => {
    if (!show) return;
    const previousFocus = document.activeElement;
    dialogRef.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [show]);

  React.useEffect(() => {
    if (!show) return;
    const focused = document.activeElement;
    // Preserve a newly mounted form's autoFocus when changing steps.
    if (
      focused instanceof HTMLElement &&
      dialogRef.current?.contains(focused) &&
      focused.getClientRects().length
    )
      return;
    dialogRef.current?.focus();
  }, [show, step]);

  return { show, step, project, dialogRef, titleId, close, setStep, onProjectSaved, trapFocus };
};
