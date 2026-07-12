import React from 'react';
import { Autocomplete } from '@renderer/components/Autocomplete';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Input } from '@renderer/components/Input';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import {
  useStoreContext,
  type IImportConnectionsPreview,
  type ImportConnectionsSource,
} from '@renderer/contexts/Store';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import call from '@renderer/utils/call';
import styles from './styles.module.css';

const originOptions: { label: string; value: ImportConnectionsSource }[] = [
  { label: 'DBeaver', value: 'dbeaver' },
];

const makeSelectionKey = (sourceName: string, sourceId: string) => `${sourceName}:${sourceId}`;

export const SettingsImportPanel = React.memo(() => {
  const { previewImportConnectionsFromSource, importConnectionsFromSource } = useStoreContext();
  const { showToast } = useToast();

  const {
    activeTheme: { __colors, modal: colors },
  } = useThemeContext();

  const [source, setSource] = React.useState<ImportConnectionsSource>('dbeaver');
  const [masterPassword, setMasterPassword] = React.useState('');
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [loadingImport, setLoadingImport] = React.useState(false);
  const [preview, setPreview] = React.useState<IImportConnectionsPreview>();
  const [selectedItems, setSelectedItems] = React.useState<Set<string>>(new Set());
  const [result, setResult] =
    React.useState<Awaited<ReturnType<typeof importConnectionsFromSource>>>();

  const selectedConnectionsCount = React.useMemo(() => selectedItems.size, [selectedItems]);

  const selectPreviewItems = React.useCallback((importPreview: IImportConnectionsPreview) => {
    const nextSelectedItems = new Set<string>();

    for (const project of importPreview.projects) {
      for (const connection of project.connections) {
        if (!connection.alreadyExists) {
          nextSelectedItems.add(makeSelectionKey(project.sourceName, connection.sourceId));
        }
      }
    }

    setSelectedItems(nextSelectedItems);
  }, []);

  const loadPreview = React.useCallback(
    async (path: string) => {
      try {
        setLoadingPreview(true);
        setResult(undefined);

        const importPreview = await previewImportConnectionsFromSource({
          source,
          path,
          masterPassword: masterPassword || undefined,
        });

        setPreview(importPreview);
        selectPreviewItems(importPreview);
      } catch (error) {
        showToast({
          type: 'error',
          title: 'Falha ao ler arquivo',
          description: error.message,
        });
      } finally {
        setLoadingPreview(false);
      }
    },
    [source, masterPassword, previewImportConnectionsFromSource, selectPreviewItems, showToast],
  );

  const handleSelectFile = React.useCallback(async () => {
    const path = await call<string | null>('@dialog:select_dbeaver_export_file');

    if (!path) return;

    await loadPreview(path);
  }, [loadPreview]);

  const toggleProject = React.useCallback(
    (project: IImportConnectionsPreview['projects'][number], checked: boolean) => {
      setSelectedItems((prev) => {
        const next = new Set(prev);

        for (const connection of project.connections) {
          const key = makeSelectionKey(project.sourceName, connection.sourceId);
          checked ? next.add(key) : next.delete(key);
        }

        return next;
      });
    },
    [],
  );

  const toggleConnection = React.useCallback((key: string, checked: boolean) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);

      checked ? next.add(key) : next.delete(key);

      return next;
    });
  }, []);

  const handleConfirmImport = React.useCallback(async () => {
    if (!preview || !selectedConnectionsCount) return;

    const selection = {
      projects: preview.projects
        .map((project) => ({
          sourceName: project.sourceName,
          connections: project.connections
            .filter((connection) =>
              selectedItems.has(makeSelectionKey(project.sourceName, connection.sourceId)),
            )
            .map((connection) => connection.sourceId),
        }))
        .filter((project) => project.connections.length),
    };

    try {
      setLoadingImport(true);

      const importResult = await importConnectionsFromSource({
        source,
        path: preview.path,
        masterPassword: masterPassword || undefined,
        selection,
      });

      setResult(importResult);
      showToast({
        type: 'success',
        title: 'Importação concluída',
        description: `${importResult.connectionsImported} conexões importadas`,
      });
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Falha ao importar',
        description: error.message,
      });
    } finally {
      setLoadingImport(false);
    }
  }, [
    preview,
    selectedConnectionsCount,
    selectedItems,
    source,
    masterPassword,
    importConnectionsFromSource,
    showToast,
  ]);

  return (
    <>
      <Text bold color={colors.color} userSelect={false}>
        Importação
      </Text>

      <Divider size={8} />

      <Row>
        <Autocomplete
          required
          clearable={false}
          data={originOptions}
          label="Origem"
          value={source}
          extractLabel={(item) => item.label}
          extractValue={(item) => item.value}
          color={colors.fieldColor}
          backgroundColor={colors.fieldBackgroundColor}
          xs={12}
          onChange={(event) => setSource(event.value as ImportConnectionsSource)}
        />
      </Row>

      <Divider size={8} />

      <Text small color={__colors.gray}>
        Selecione um arquivo e revise os itens antes de confirmar.
      </Text>

      {!!preview?.requiresMasterPassword && (
        <>
          <Divider size={8} />

          <Row>
            <Input
              label="Senha mestra"
              type="password"
              placeholder="Digite a senha mestra"
              value={masterPassword}
              onChange={(event) => setMasterPassword(event.target.value)}
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
              placeholderColor={__colors.gray}
              xs={12}
              sm={8}
            />

            <Button
              xs={12}
              sm={4}
              onClick={() => loadPreview(preview.path)}
              loading={loadingPreview}
              color={colors.testButtonColor}
              backgroundColor={colors.testButtonBackgroundColor}
            >
              Atualizar preview
            </Button>
          </Row>
        </>
      )}

      {!!preview && (
        <>
          <Divider size={12} />

          <div className={styles.previewBox}>
            {preview.projects.map((project) => {
              const projectSelectedCount = project.connections.filter((connection) =>
                selectedItems.has(makeSelectionKey(project.sourceName, connection.sourceId)),
              ).length;
              const allProjectSelected =
                !!project.connections.length && projectSelectedCount === project.connections.length;

              return (
                <div key={project.sourceName} className={styles.projectPreview}>
                  <label className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={allProjectSelected}
                      onChange={(event) => toggleProject(project, event.target.checked)}
                    />
                    <span className={styles.projectTitle}>{project.description}</span>
                    <span className={styles.mutedText}>({project.connections.length})</span>
                  </label>

                  <div className={styles.connectionsPreview}>
                    {project.connections.map((connection) => {
                      const key = makeSelectionKey(project.sourceName, connection.sourceId);

                      return (
                        <label key={key} className={styles.connectionRow}>
                          <input
                            type="checkbox"
                            checked={selectedItems.has(key)}
                            onChange={(event) => toggleConnection(key, event.target.checked)}
                          />

                          <span className={styles.connectionInfo}>
                            <strong>{connection.description}</strong>
                            <small>
                              {connection.dialect} | {connection.database || connection.host}
                              {connection.alreadyExists ? ' | já existe' : ''}
                              {connection.username ? ` | usuário: ${connection.username}` : ''}
                              {connection.hasPassword ? ' | com senha' : ''}
                            </small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!!result && (
        <>
          <Divider size={12} />

          <div className={styles.resultBox}>
            <Text small color={colors.color}>
              Projetos criados: {result.projectsCreated} | reutilizados: {result.projectsReused}
            </Text>
            <Text small color={colors.color}>
              Conexões importadas: {result.connectionsImported} | ignoradas:{' '}
              {result.connectionsSkipped}
            </Text>
            {!!result.unsupportedConnections.length && (
              <Text small color={__colors.orange}>
                {result.unsupportedConnections.length} conexões de dialetos não suportados foram
                ignoradas.
              </Text>
            )}
            {result.warnings.slice(0, 2).map((warning) => (
              <Text key={warning} small color={__colors.orange}>
                {warning}
              </Text>
            ))}
          </div>
        </>
      )}

      <Divider size={16} />

      <Row>
        <Button
          xs={12}
          sm={4}
          onClick={handleSelectFile}
          loading={loadingPreview}
          color={colors.testButtonColor}
          backgroundColor={colors.testButtonBackgroundColor}
        >
          Selecionar arquivo
        </Button>

        <Spacer />

        <Button
          xs={12}
          sm={4}
          onClick={handleConfirmImport}
          loading={loadingImport}
          disabled={!selectedConnectionsCount}
          color={colors.saveButtonColor}
          backgroundColor={colors.saveButtonBackgroundColor}
        >
          Confirmar importação
        </Button>
      </Row>
    </>
  );
});

SettingsImportPanel.displayName = 'SettingsImportPanel';
