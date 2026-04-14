import React from 'react';
import { FaGripLines } from 'react-icons/fa';
import { Spacer } from '@renderer/components/Spacer';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { Bar } from '@renderer/components/Bar';
import Editor from '@renderer/components/Editor';
import { Row } from '@renderer/components/Grid';
import { Input } from '@renderer/components/Input';
import { TabBar, TabContent, TabWindow } from '@renderer/components/Tabs';
import { generateHash } from '@renderer/utils/string';
import { useStoreContext } from '@renderer/contexts/Store';
import useEditorCtrlClickNavigate from '@renderer/hooks/useEditorCtrlClickNavigate';
import { IconRefresh } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import { useThemeContext } from '@renderer/contexts/Theme';
import styles from './styles.module.css';

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
  const { getFunctionDefinition } = useStoreContext();
  const handleEditorCtrlClick = useEditorCtrlClickNavigate(id_connection);

  const [topTabId] = React.useState(generateHash());
  const [sideTabId] = React.useState(generateHash());

  const [definition, setDefinition] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [lastFetchDate, setLastFetchDate] = React.useState<Date | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const rows = await getFunctionDefinition(id_connection, {
        schema,
        functionName: function_name,
      });
      setDefinition(rows?.map((r) => r.definition).join('\n\n') || '');
      setLastFetchDate(new Date());
    } finally {
      setLoading(false);
    }
  }, [id_connection, schema, function_name]);

  React.useEffect(() => {
    load();
  }, []);

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
            icon: () => <FaGripLines className={styles.icon} />,
          },
        ]}
      />

      <TabWindow idTabBar={topTabId}>
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

              <TabWindow idTabBar={sideTabId}>
                <TabContent idTab="tabDefinition">
                  <div className={styles.editorContainer}>
                    <Editor
                      dialect="postgres"
                      language="sql"
                      readonly
                      value={loading ? '' : definition}
                      onCtrlClick={handleEditorCtrlClick}
                    />
                  </div>
                  <Bar
                    backgroundColor={propertiesTheme.bar.backgroundColor}
                    borderColor={propertiesTheme.bar.borderColor}
                  >
                    <Button
                      title="Atualizar dados"
                      text
                      smallIcon
                      color={propertiesTheme.bar.color}
                      onClick={load}
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
    </div>
  );
};

export default FunctionInfo;
