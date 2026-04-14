import React from 'react';
import { Spacer } from '@renderer/components/Spacer';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { Bar } from '@renderer/components/Bar';
import Editor from '@renderer/components/Editor';
import { ITableInfoProps } from '@renderer/views/TableInfo/dtos';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { IconRefresh } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { useThemeContext } from '@renderer/contexts/Theme';
import useEditorCtrlClickNavigate from '@renderer/hooks/useEditorCtrlClickNavigate';
import styles from './styles.module.css';

const Definition = ({ id_connection, schema, table }: ITableInfoProps) => {
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();
  const { definition, loadTableDefinition, lastFetchDate, loading } = useTableInfoContext();
  const handleEditorCtrlClick = useEditorCtrlClickNavigate(id_connection);

  React.useEffect(() => {
    loadTableDefinition(id_connection, { schema, table });
  }, []);

  return (
    <>
      <div className={styles.editorContainer}>
        <Editor
          dialect="postgres"
          language="sql"
          readonly
          value={loading.definition ? '' : definition}
          onCtrlClick={handleEditorCtrlClick}
        />
      </div>
      <Bar backgroundColor={theme.bar.backgroundColor} borderColor={theme.bar.borderColor}>
        <Button
          title="Atualizar dados"
          text
          smallIcon
          color={theme.bar.color}
          onClick={() => loadTableDefinition(id_connection, { schema, table })}
        >
          <IconRefresh size={18} />
        </Button>

        <Spacer />

        <Text userSelect={false} title="Data da última atualização" color={theme.bar.color}>
          Atualizado em {toDateTime(lastFetchDate.definition)}
        </Text>
      </Bar>
    </>
  );
};

export default Definition;
