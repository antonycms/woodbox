import { getErrorMessage } from '@shared/utils/error';
import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import type { ProjectExportFormat } from '@shared/types/imports';
import { Autocomplete } from '@renderer/components/Autocomplete';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useDialogsStore } from '@renderer/stores/Dialogs';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { useToastStore } from '@renderer/stores/Toast';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import styles from '../ModalImportProjects/styles.module.css';

const formatOptions: { label: string; value: ProjectExportFormat }[] = [
  { label: 'Woodbox', value: 'woodbox' },
  { label: 'DBeaver', value: 'dbeaver' },
];

export const ModalExportProjects = React.memo((props: IModalExportProjectsProps) => {
  const { show, onClose } = props;
  const dialogs = useDialogsStore(
    useShallow((state) => ({
      selectProjectExportFile: state.selectProjectExportFile,
    })),
  );
  const { exportProjects, projects, connections } = useWorkspaceStore(
    useShallow((state) => ({
      exportProjects: state.exportProjects,
      projects: state.projects,
      connections: state.connections,
    })),
  );
  const t = useI18nStore((state) => state.t);
  const showToast = useToastStore((state) => state.showToast);
  const { settings, modal: colors } = useThemeStore((state) => state.activeTheme);

  const [format, setFormat] = React.useState<ProjectExportFormat>('woodbox');
  const [path, setPath] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [selectedProjectIds, setSelectedProjectIds] = React.useState<Set<string>>(new Set());
  const [selectedConnectionIds, setSelectedConnectionIds] = React.useState<Set<string>>(new Set());
  const [result, setResult] = React.useState<Awaited<ReturnType<typeof exportProjects>>>();

  const connectionsByProject = React.useMemo(() => {
    const map = new Map<string, typeof connections>();

    for (const project of projects) map.set(project.id, []);
    for (const connection of connections) {
      const projectConnections = map.get(connection.id_project);

      if (projectConnections) projectConnections.push(connection);
    }

    return map;
  }, [projects, connections]);
  const selectedProjectsCount = React.useMemo(
    () => projects.filter((project) => selectedProjectIds.has(project.id)).length,
    [projects, selectedProjectIds],
  );
  const themedPanelStyle = React.useMemo(
    () =>
      ({
        '--settings-import-border-color': settings.importBorderColor,
        '--settings-import-background-color': settings.importBackgroundColor,
        '--settings-import-color': colors.color,
        '--settings-import-muted-color': settings.importMutedColor,
      }) as React.CSSProperties,
    [settings.importBackgroundColor, settings.importMutedColor, settings.importBorderColor, colors.color],
  );

  const toggleProject = React.useCallback(
    (projectId: string, checked: boolean) => {
      setSelectedProjectIds((prev) => {
        const next = new Set(prev);

        checked ? next.add(projectId) : next.delete(projectId);

        return next;
      });
      setSelectedConnectionIds((prev) => {
        const next = new Set(prev);

        for (const connection of connectionsByProject.get(projectId) || []) {
          checked ? next.add(connection.id) : next.delete(connection.id);
        }

        return next;
      });
    },
    [connectionsByProject],
  );

  const toggleConnection = React.useCallback((projectId: string, connectionId: string, checked: boolean) => {
    setSelectedProjectIds((prev) => {
      if (!checked) return prev;

      const next = new Set(prev);

      next.add(projectId);

      return next;
    });
    setSelectedConnectionIds((prev) => {
      const next = new Set(prev);

      checked ? next.add(connectionId) : next.delete(connectionId);

      return next;
    });
  }, []);

  const handleSelectFile = React.useCallback(async () => {
    const selectedPath = await dialogs.selectProjectExportFile(format);

    if (!selectedPath) return;

    setPath(selectedPath);
    setResult(undefined);
  }, [dialogs, format]);

  const handleConfirmExport = React.useCallback(async () => {
    if (!path || !selectedProjectsCount) return;

    const selection = {
      projects: projects
        .filter((project) => selectedProjectIds.has(project.id))
        .map((project) => ({
          id: project.id,
          connections: (connectionsByProject.get(project.id) || [])
            .filter((connection) => selectedConnectionIds.has(connection.id))
            .map((connection) => connection.id),
        })),
    };

    try {
      setLoading(true);

      const exportResult = await exportProjects({ format, path, selection });

      setResult(exportResult);
      showToast({
        type: 'success',
        title: t('settings.export.exportCompletedTitle'),
        description: t('settings.export.connectionsExportedDescription', {
          connections: exportResult.connectionsExported,
          scripts: exportResult.scriptsExported,
        }),
      });
      onClose?.();
    } catch (error: unknown) {
      showToast({
        type: 'error',
        title: t('settings.export.exportFailedTitle'),
        description: getErrorMessage(error, t('common.unknownError')),
      });
    } finally {
      setLoading(false);
    }
  }, [
    connectionsByProject,
    exportProjects,
    format,
    onClose,
    path,
    projects,
    selectedConnectionIds,
    selectedProjectIds,
    selectedProjectsCount,
    showToast,
    t,
  ]);

  React.useEffect(() => {
    if (!show) return;

    setSelectedProjectIds(new Set(projects.map((project) => project.id)));
    setSelectedConnectionIds(new Set(connections.map((connection) => connection.id)));
    setResult(undefined);
  }, [connections, projects, show]);

  return (
    <Modal
      title={t('settings.export.title')}
      width="720px"
      show={show}
      closeOutside
      onClose={onClose}
    >
      <Row>
        <Autocomplete
          required
          clearable={false}
          data={formatOptions}
          label={t('settings.export.format')}
          value={format}
          extractLabel={(item) => item.label}
          extractValue={(item) => item.value}
          color={colors.fieldColor}
          backgroundColor={colors.fieldBackgroundColor}
          xs={12}
          onChange={(event) => {
            setFormat(event.value as ProjectExportFormat);
            setPath('');
            setResult(undefined);
          }}
        />
      </Row>

      <Divider size={8} />

      <Text small color={settings.importMutedColor} userSelect={false}>
        {t('settings.export.instructions')}
      </Text>

      <Divider size={12} />

      <div className={styles.previewBox} style={themedPanelStyle}>
        {!projects.length && (
          <Text userSelect={false} small color={settings.importMutedColor}>
            {t('settings.export.emptySelection')}
          </Text>
        )}

        {projects.map((project) => {
          const projectConnections = connectionsByProject.get(project.id) || [];
          const selectedProjectConnections = projectConnections.filter((connection) =>
            selectedConnectionIds.has(connection.id),
          );

          return (
            <div key={project.id} className={styles.projectPreview}>
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={selectedProjectIds.has(project.id)}
                  onChange={(event) => toggleProject(project.id, event.target.checked)}
                />
                <span className={styles.projectTitle}>{project.description}</span>
                <span className={styles.mutedText}>
                  {t('settings.export.selectedConnectionsMeta', {
                    selected: selectedProjectConnections.length,
                    total: projectConnections.length,
                  })}
                </span>
              </label>

              <div className={styles.connectionsPreview}>
                {projectConnections.map((connection) => {
                  const connectionInfo = [
                    connection.dialect,
                    connection.database || connection.host,
                    connection.username
                      ? t('settings.export.userMeta', { username: connection.username })
                      : undefined,
                    connection.hasPassword ? t('settings.export.withPassword') : undefined,
                  ]
                    .filter(Boolean)
                    .join(' | ');

                  return (
                    <label key={connection.id} className={styles.connectionRow}>
                      <input
                        type="checkbox"
                        checked={
                          selectedProjectIds.has(project.id) && selectedConnectionIds.has(connection.id)
                        }
                        onChange={(event) =>
                          toggleConnection(project.id, connection.id, event.target.checked)
                        }
                      />

                      <span className={styles.connectionInfo}>
                        <strong>{connection.description}</strong>
                        <small>{connectionInfo}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Divider size={12} />

      <Row>
        <Input
          readOnly
          label={t('settings.export.filePath')}
          placeholder={t('file.noneSelected')}
          value={path}
          onClick={handleSelectFile}
          color={colors.fieldColor}
          backgroundColor={colors.fieldBackgroundColor}
          placeholderColor={settings.importMutedColor}
          xs={12}
          sm={8}
        />

        <Button
          xs={12}
          sm={4}
          onClick={handleSelectFile}
          color={colors.testButtonColor}
          backgroundColor={colors.testButtonBackgroundColor}
        >
          {t('settings.export.selectFile')}
        </Button>
      </Row>

      {!!result && (
        <>
          <Divider size={12} />

          <div className={styles.resultBox} style={themedPanelStyle}>
            <Text userSelect={false} small color={colors.color}>
              {t('settings.export.projectsSummary', {
                projects: result.projectsExported,
                connections: result.connectionsExported,
                scripts: result.scriptsExported,
              })}
            </Text>
            {!!result.unsupportedConnections.length && (
              <Text userSelect={false} small color={settings.importWarningColor}>
                {t('settings.export.unsupportedConnections', {
                  count: result.unsupportedConnections.length,
                })}
              </Text>
            )}
          </div>
        </>
      )}

      <Divider size={16} />

      <Row>
        <Spacer />

        <Button
          xs={6}
          sm={4}
          md={3}
          onClick={onClose}
          color={colors.cancelButtonColor}
          backgroundColor={colors.cancelButtonBackgroundColor}
        >
          {t('common.cancel')}
        </Button>

        <Button
          xs={6}
          sm={4}
          md={3}
          onClick={handleConfirmExport}
          loading={loading}
          disabled={!path || !selectedProjectsCount}
          color={colors.saveButtonColor}
          backgroundColor={colors.saveButtonBackgroundColor}
        >
          {t('settings.export.confirmExport')}
        </Button>
      </Row>
    </Modal>
  );
});

ModalExportProjects.displayName = 'ModalExportProjects';

export interface IModalExportProjectsProps {
  show?: boolean;
  onClose?: () => void;
}
