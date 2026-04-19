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
import Diagram from './tabs/Diagram';
import styles from './styles.module.css';

interface IPropertiesProps extends ITableInfoProps {
  onOpenTable?: (idConnection: string, schema: string, table: string) => void;
}

const Properties = (props: IPropertiesProps) => {
  const { table } = props;
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();

  const [id] = React.useState(generateHash());
  const [activeTabId, setActiveTabId] = React.useState<string>('1');

  const { register: registerFormData } = useForm({
    table: table || '',
    comment: '',
  });

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
            {...registerFormData('table')}
          />
          <Input
            md={6}
            label="Comentário"
            backgroundColor={theme.header.fieldBackgroundColor}
            color={theme.header.fieldColor}
            {...registerFormData('comment')}
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
          tabs={[
            { idTab: '1', title: 'Colunas' },
            { idTab: '2', title: 'Restrições' },
            { idTab: '3', title: 'Chaves Estrangeiras' },
            { idTab: '4', title: 'Referências' },
            { idTab: '7', title: 'Diagrama' },
            { idTab: '6', title: 'Triggers' },
            { idTab: '5', title: 'Definição' },
          ]}
        />

        <TabWindow idTabBar={id}>
          <TabContent idTab="1">
            <Columns {...props} />
          </TabContent>

          <TabContent idTab="2">
            <Restrictios {...props} />
          </TabContent>

          <TabContent idTab="3">
            <ForeingKeys {...props} />
          </TabContent>

          <TabContent idTab="4">
            <References {...props} />
          </TabContent>

          <TabContent idTab="7">
            <Diagram active={activeTabId === '7'} {...props} />
          </TabContent>

          <TabContent idTab="5">
            <Definition {...props} />
          </TabContent>

          <TabContent idTab="6">
            <Triggers {...props} />
          </TabContent>
        </TabWindow>
      </div>
    </div>
  );
};

export default Properties;
