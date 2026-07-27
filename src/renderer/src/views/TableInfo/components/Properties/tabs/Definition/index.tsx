import React from 'react';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { RefreshButton } from '@renderer/components/RefreshButton';
import { Bar } from '@renderer/components/Bar';
import Editor from '@renderer/components/Editor';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { toDateTime } from '@renderer/utils/date';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import useEditorCtrlClickNavigate from '@renderer/hooks/useEditorCtrlClickNavigate';
import { useStoreContext } from '@renderer/contexts/Store';
import { getRendererDialect } from '@renderer/database/dialects';
import styles from './styles.module.css';

const Definition = ({ id_connection, schema, table }: ITableInfoProps) => {
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();
  const { t } = useI18n();
  const { definition, loadTableDefinition, lastFetchDate, loading } = useTableInfoContext();
  const { connections } = useStoreContext();
  const dialect = React.useMemo(
    () =>
      getRendererDialect(
        connections.find((connection) => connection.id === id_connection)?.dialect,
      ),
    [connections, id_connection],
  );
  const handleEditorCtrlClick = useEditorCtrlClickNavigate(id_connection);

  React.useEffect(() => {
    // Monta uma vez: a aba é recriada quando a tabela/conexão muda.
    loadTableDefinition(id_connection, { schema, table });
  }, []);

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
