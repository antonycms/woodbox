import React from 'react';
import { Row } from '@renderer/components/Grid';
import { Input } from '@renderer/components/Input';
import { TabBar, TabContent, TabWindow } from '@renderer/components/Tabs';
import { generateHash } from '@renderer/utils/string';
import { useForm } from '@renderer/hooks/useForm';
import { useThemeContext } from '@renderer/contexts/Theme';
import { ITableInfoProps } from '../../dtos';
import Columns from './tabs/Columns';
import ForeingKeys from './tabs/ForeingKeys';
import Restrictios from './tabs/Restrictions';
import References from './tabs/References';
import Definition from './tabs/Definition';
import Triggers from './tabs/Triggers';
import Indexes from './tabs/Indexes';
import Diagram from './tabs/Diagram';
import styles from './styles.module.css';

interface IPropertiesProps extends ITableInfoProps {
  onOpenTable?: (idConnection: string, schema: string, table: string) => void;
}

const Properties = (props: IPropertiesProps) => {
  const { table } = props;
  const isCreateMode = props.mode === 'create';
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();

  const [id] = React.useState(generateHash());
  const [activeTabId, setActiveTabId] = React.useState<string>('1');

  const { state, register } = useForm({
    table: table || '',
    comment: '',
  });

  const tableName = isCreateMode ? state.table.trim() : table;

  const tabs = React.useMemo(() => {
    const allowedTabs = [
      { idTab: '1', title: 'Colunas' },
      { idTab: '8', title: 'Índices' },
      { idTab: '2', title: 'Restrições' },
      { idTab: '3', title: 'Chaves Estrangeiras' },
    ];

    if (!isCreateMode) {
      allowedTabs.push(
        { idTab: '4', title: 'Referências' },
        { idTab: '7', title: 'Diagrama' },
        { idTab: '6', title: 'Triggers' },
        { idTab: '5', title: 'Definição' },
      );
    }

    return allowedTabs;
  }, []);

  return (
    <div className={styles.propertiesContainer}>
      <div
        className={styles.propertiesHeader}
        style={{ backgroundColor: theme.header.backgroundColor }}
      >
        <Row>
          <Input
            md={6}
            required
            label="Tabela"
            backgroundColor={theme.header.fieldBackgroundColor}
            color={theme.header.fieldColor}
            {...register('table')}
          />
          <Input
            md={6}
            label="Comentário"
            backgroundColor={theme.header.fieldBackgroundColor}
            color={theme.header.fieldColor}
            {...register('comment')}
          />
        </Row>
      </div>

      <div
        className={styles.propertiesContent}
        style={{
          border: `1px solid ${theme.bar.borderColor}`,
          backgroundColor: theme.tab.backgroundColor,
        }}
      >
        <TabBar
          vertical
          borderRight
          width="auto"
          idTabBar={id}
          ascentColor={theme.tab.ascentColor}
          backgroundColor={theme.tab.backgroundColor}
          backgroundColorBar={theme.tab.backgroundColor}
          borderColor={theme.tab.borderColor}
          color={theme.bar.color}
          activeTabId={activeTabId}
          onActiveTab={(tab) => setActiveTabId(tab?.idTab)}
          tabs={tabs}
        />

        <TabWindow idTabBar={id}>
          <TabContent idTab="1">
            <Columns {...props} table={tableName} tableComment={state.comment} />
          </TabContent>

          <TabContent idTab="8">
            <Indexes {...props} table={tableName} tableComment={state.comment} />
          </TabContent>

          <TabContent idTab="2">
            <Restrictios {...props} table={tableName} tableComment={state.comment} />
          </TabContent>

          <TabContent idTab="3">
            <ForeingKeys {...props} table={tableName} tableComment={state.comment} />
          </TabContent>

          {!isCreateMode && (
            <TabContent idTab="4">
              <References {...props} />
            </TabContent>
          )}

          {!isCreateMode && (
            <TabContent idTab="7">
              <Diagram active={activeTabId === '7'} {...props} />
            </TabContent>
          )}

          {!isCreateMode && (
            <TabContent idTab="5">
              <Definition {...props} />
            </TabContent>
          )}

          {!isCreateMode && (
            <TabContent idTab="6">
              <Triggers {...props} />
            </TabContent>
          )}
        </TabWindow>
      </div>
    </div>
  );
};

export default Properties;
