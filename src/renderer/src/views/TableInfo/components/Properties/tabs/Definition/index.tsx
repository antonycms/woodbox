import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { RefreshButton } from '@renderer/components/RefreshButton';
import { Bar } from '@renderer/components/Bar';
import Editor from '@renderer/components/Editor';
import { ITableInfoViewProps } from '@renderer/views/TableInfo/dtos';
import { useTableInfoStore } from '@renderer/stores/TableInfo';
import { toDateTime } from '@renderer/utils/date';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import useEditorCtrlClickNavigate from '@renderer/hooks/useEditorCtrlClickNavigate';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { getRendererDialect } from '@renderer/database/dialects';
import styles from './styles.module.css';

const Definition = ({ tableStore, id_connection, schema, table }: ITableInfoViewProps) => {
  const {
    tableInfo: { properties: theme },
  } = useThemeStore((state) => state.activeTheme);
  const t = useI18nStore((state) => state.t);
  const { definition, loadTableDefinition, lastFetchDate, loading } = useTableInfoStore(
    tableStore,
    useShallow((state) => ({
      definition: state.definition,
      loadTableDefinition: state.loadTableDefinition,
      lastFetchDate: state.lastFetchDate,
      loading: state.loading,
    })),
  );
  const connections = useWorkspaceStore((state) => state.connections);
  const dialect = React.useMemo(
    () =>
      getRendererDialect(
        connections.find((connection) => connection.id === id_connection)?.dialect,
      ),
    [connections, id_connection],
  );
  const handleEditorCtrlClick = useEditorCtrlClickNavigate(id_connection);

  React.useEffect(() => {
    loadTableDefinition(id_connection, { schema, table });
  }, [id_connection, loadTableDefinition, schema, table]);

  return (
    <>
      <div className={styles.editorContainer}>
        <Editor
          dialect={dialect.editorDialect}
          language="sql"
          readonly
          value={loading.definition ? '' : definition}
          onCtrlClick={handleEditorCtrlClick}
        />
      </div>
      <Bar backgroundColor={theme.bar.backgroundColor} borderColor={theme.bar.borderColor}>
        <RefreshButton
          menuPlacement="top"
          color={theme.bar.color}
          onRefresh={() => loadTableDefinition(id_connection, { schema, table })}
        />

        <Spacer />

        <Text userSelect={false} title={t('common.lastUpdatedAt')} color={theme.bar.color}>
          {t('common.updatedAt', { date: toDateTime(lastFetchDate.definition) })}
        </Text>
      </Bar>
    </>
  );
};

export default Definition;
