import React from 'react';
import type { IProject } from '@shared/types/workspace';
import { getErrorMessage } from '@shared/utils/error';
import { Input } from '@renderer/components/Input';
import { Row } from '@renderer/components/Grid';
import { useForm } from '@renderer/hooks/useForm';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { useToastStore } from '@renderer/stores/Toast';
import { OnboardingFooter } from '../OnboardingFooter';
import styles from './styles.module.css';

interface Props {
  project?: IProject;
  onSaved: (project: IProject) => void;
  onSkip: () => void;
  onBack: () => void;
}

export const ProjectStep = ({ project, onSaved, onSkip, onBack }: Props) => {
  const t = useI18nStore((state) => state.t);
  const colors = useThemeStore((state) => state.activeTheme.modal);
  const addProject = useWorkspaceStore((state) => state.addProject);
  const editProject = useWorkspaceStore((state) => state.editProject);
  const showToast = useToastStore((state) => state.showToast);
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);
  const { register, handleSubmit } = useForm({ description: project?.description || '' });

  const submit = handleSubmit(async ({ description }) => {
    if (savingRef.current) return;
    const name = description.trim();
    if (!name) {
      showToast({ type: 'warn', title: t('onboarding.projectNameRequired') });
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      if (project) {
        await editProject(project.id, { description: name });
        onSaved({ ...project, description: name });
      } else {
        onSaved(await addProject({ description: name }));
      }
    } catch (error: unknown) {
      showToast({
        type: 'error',
        title: t('onboarding.projectSaveError'),
        description: getErrorMessage(error, t('common.unknownError')),
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  });

  return (
    <form className={styles.form} onSubmit={submit}>
      <Row>
        <Input
          xs={12}
          autoFocus
          required
          disabled={saving}
          label={t('onboarding.projectName')}
          placeholder={t('onboarding.projectPlaceholder')}
          color={colors.fieldColor}
          backgroundColor={colors.fieldBackgroundColor}
          labelColor={colors.fieldLabelColor}
          {...register('description')}
        />
      </Row>
      <OnboardingFooter onSkip={onSkip} onBack={onBack} submit loading={saving} />
    </form>
  );
};
