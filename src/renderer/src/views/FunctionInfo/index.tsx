import React from 'react';
import { Spacer } from '@renderer/components/Spacer';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { Bar } from '@renderer/components/Bar';
import Editor, { IEditorRef } from '@renderer/components/Editor';
import { Row } from '@renderer/components/Grid';
import { Input } from '@renderer/components/Input';
import { TabBar, TabContent, TabWindow } from '@renderer/components/Tabs';
import { generateHash } from '@renderer/utils/string';
import { useStoreContext } from '@renderer/contexts/Store';
import useEditorCtrlClickNavigate from '@renderer/hooks/useEditorCtrlClickNavigate';
import { IconRefresh, SaveIcon } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import ModalApplyPendingDDL from '@renderer/views/TableInfo/components/Properties/components/ModalApplyPendingDDL';
import { getRendererDialect } from '@renderer/database/dialects';
import { isPrimaryShortcutPressed } from '@renderer/utils/keyboard';
import styles from './styles.module.css';

import IconFaSolidGripLines from '~icons/fa-solid/grip-lines';

interface IFunctionInfoProps {
  id_connection: string;
  schema: string;
  function_name: string;
}

const FunctionInfo = ({ id_connection, schema, function_name }: IFunctionInfoProps) => {
  const {
    activeTheme: {
      tableInfo: { properties: propertiesTheme, tab: tabTheme },
    },
  } = useThemeContext();
  const { getFunctionDefinition, runSql, connections } = useStoreContext();
  const { showToast } = useToast();
  const dialect = React.useMemo(
    () =>
      getRendererDialect(
        connections.find((connection) => connection.id === id_connection)?.dialect,
      ),
    [connections, id_connection],
  );
  const handleEditorCtrlClick = useEditorCtrlClickNavigate(id_connection);
  const refEditor = React.useRef<IEditorRef>(null);

  const [topTabId] = React.useState(generateHash());
  const [sideTabId] = React.useState(generateHash());

  const [definition, setDefinition] = React.useState('');
  const [savedDefinition, setSavedDefinition] = React.useState('');
  const [pendingSql, setPendingSql] = React.useState('');
  const [showApplyModal, setShowApplyModal] = React.useState(false);
  const [applying, setApplying] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [lastFetchDate, setLastFetchDate] = React.useState<Date | null>(null);

  const hasChanges = definition !== savedDefinition;

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getFunctionDefinition(id_connection, {
        schema,
        functionName: function_name,
      });

      const nextDefinition = rows?.map((r) => r.definition).join('\n\n') || '';

      setDefinition(nextDefinition);
      setSavedDefinition(nextDefinition);
      setLastFetchDate(new Date());

      refEditor.current.setValue(nextDefinition);
    } finally {
      setLoading(false);
    }
  }, [getFunctionDefinition, id_connection, schema, function_name]);

  const handleSave = React.useCallback(() => {
    const sql = refEditor.current?.getValue?.() ?? definition;

    if (!sql.trim()) {
      showToast({ type: 'warn', title: 'Informe o SQL da função.' });
      return;
    }

    if (sql === savedDefinition) return;

    setPendingSql(sql);
    setShowApplyModal(true);
  }, [definition, savedDefinition, showToast]);

  const handleApply = React.useCallback(
    async (sql: string) => {
      try {
        setApplying(true);

        await runSql(id_connection, sql);
        setShowApplyModal(false);
        showToast({ type: 'success', title: 'Função salva com sucesso!' });

        await Promise.all([load()]);
      } catch (error: any) {
        showToast({
          type: 'error',
          title: 'Erro ao salvar função.',
          description: error?.message,
          delay: 8000,
        });
      } finally {
        setApplying(false);
      }
    },
    [id_connection, load, runSql, showToast],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (isPrimaryShortcutPressed(event) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        handleSave();
      }
    },
    [handleSave],
  );

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={styles.container}>
      <TabBar
        borderBottom
        idTabBar={topTabId}
        activeTabId="tabProperties"
        onActiveTab={() => {}}
        ascentColor={tabTheme.ascentColor}
        backgroundColor={tabTheme.backgroundColor}
        backgroundColorBar={tabTheme.bar.backgroundColor}
        borderColor={tabTheme.borderColor}
        color={tabTheme.color}
        tabs={[
          {
            idTab: 'tabProperties',
            title: 'Propriedades',
            icon: () => <IconFaSolidGripLines className={styles.icon} width={12} height={12} />,
          },
        ]}
      />

      <TabWindow activeTabId="tabProperties">
        <TabContent idTab="tabProperties">
          <div className={styles.propertiesContainer}>
            <div
              className={styles.propertiesHeader}
              style={{ backgroundColor: propertiesTheme.header.backgroundColor }}
            >
              <Row>
                <Input
                  disabled
                  md={6}
                  label="Função"
                  backgroundColor={propertiesTheme.header.fieldBackgroundColor}
                  color={propertiesTheme.header.fieldColor}
                  value={function_name}
                />
                <Input
                  disabled
                  md={6}
                  label="Schema"
                  backgroundColor={propertiesTheme.header.fieldBackgroundColor}
                  color={propertiesTheme.header.fieldColor}
                  value={schema}
                />
              </Row>
            </div>
            <div
              className={styles.propertiesContent}
              style={{
                border: `1px solid ${propertiesTheme.bar.borderColor}`,
                backgroundColor: propertiesTheme.tab.backgroundColor,
              }}
            >
              <TabBar
                vertical
                borderRight
                width="auto"
                idTabBar={sideTabId}
                activeTabId="tabDefinition"
                onActiveTab={() => {}}
                ascentColor={propertiesTheme.tab.ascentColor}
                backgroundColor={propertiesTheme.tab.backgroundColor}
                backgroundColorBar={propertiesTheme.tab.backgroundColor}
                borderColor={propertiesTheme.tab.borderColor}
                color={propertiesTheme.bar.color}
                tabs={[{ idTab: 'tabDefinition', title: 'Definição' }]}
              />

              <TabWindow activeTabId="tabDefinition">
                <TabContent idTab="tabDefinition">
                  <div className={styles.editorContainer} onKeyDownCapture={handleKeyDown}>
                    <Editor
                      ref={refEditor}
                      dialect={dialect.editorDialect}
                      language="sql"
                      onChange={setDefinition}
                      onCtrlClick={handleEditorCtrlClick}
                    />
                  </div>
                  <Bar
                    backgroundColor={propertiesTheme.bar.backgroundColor}
                    borderColor={propertiesTheme.bar.borderColor}
                  >
                    <Button
                      title="Salvar"
                      text
                      smallIcon
                      color={propertiesTheme.bar.color}
                      onClick={handleSave}
                      disabled={loading || applying || !hasChanges}
                    >
                      <SaveIcon size={16} />
                    </Button>

                    <Button
                      title="Atualizar dados"
                      text
                      smallIcon
                      color={propertiesTheme.bar.color}
                      onClick={load}
                      disabled={applying}
                    >
                      <IconRefresh size={18} />
                    </Button>

                    <Spacer />

                    {lastFetchDate && (
                      <Text
                        userSelect={false}
                        title="Data da última atualização"
                        color={propertiesTheme.bar.color}
                      >
                        Atualizado em {toDateTime(lastFetchDate)}
                      </Text>
                    )}
                  </Bar>
                </TabContent>
              </TabWindow>
            </div>
          </div>
        </TabContent>
      </TabWindow>

      <ModalApplyPendingDDL
        show={showApplyModal}
        sql={pendingSql}
        applying={applying}
        onClose={() => setShowApplyModal(false)}
        dialect={dialect}
        onApply={handleApply}
      />
    </div>
  );
};

export default FunctionInfo;
