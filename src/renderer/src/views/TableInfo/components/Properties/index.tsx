import React from 'react';
import { Row } from '@renderer/components/Grid';
import { Input } from '@renderer/components/Input';
import { TabBar, TabContent, TabWindow } from '@renderer/components/Tabs';
import { generateHash } from '@renderer/utils/methods';
import { useForm } from '@renderer/hooks/useForm';
import Columns from './tabs/Columns';
import ForeingKeys from './tabs/ForeingKeys';
import Restrictios from './tabs/Restrictions';
import styles from './styles.module.css';
import { ITableInfoProps } from '../../dtos';

const Properties = (props: ITableInfoProps) => {
  const { table } = props;

  const [id] = React.useState(generateHash());
  const [activeTabId, setActiveTabId] = React.useState<string>('1');

  const { register: registerFormData } = useForm({
    table: table || '',
    comment: '',
  });

  return (
    <div className={styles.propertiesContainer}>
      <div className={styles.propertiesHeader}>
        <Row>
          <Input required label="Tabela" md={6} {...registerFormData('table')} />
          <Input label="Comentário" md={6} {...registerFormData('comment')} />
        </Row>
      </div>

      <div className={styles.propertiesContent}>
        <TabBar
          vertical
          borderRight
          width="auto"
          idTabBar={id}
          ascentColor="orange"
          activeTabId={activeTabId}
          onActiveTab={(tab) => setActiveTabId(tab?.idTab)}
          tabs={[
            { idTab: '1', title: 'Colunas' },
            { idTab: '2', title: 'Restrições' },
            { idTab: '3', title: 'Chaves Estrangeiras' },
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
        </TabWindow>
      </div>
    </div>
  );
};

export default Properties;
