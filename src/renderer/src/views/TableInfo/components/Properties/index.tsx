import React from 'react';
import { Row } from '@renderer/components/Grid';
import { Input } from '@renderer/components/Input';
import { TabBar, TabContent, TabWindow } from '@renderer/components/Tabs';
import { generateHash } from '@renderer/utils/string';
import { useForm } from '@renderer/hooks/useForm';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { useI18n } from '@renderer/contexts/I18n';
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
  onRegisterRefresh?: (refresh: () => void | Promise<void>) => void;
}

const Properties = (props: IPropertiesProps) => {
  const { table } = props;
  const isCreateMode = props.mode === 'create';
  const isReadOnlyObject = props.objectType === 'view' || props.objectType === 'materialized_view';
  const supportsIndexes = props.supportsIndexes ?? !isReadOnlyObject;
  const supportsTriggers = props.supportsTriggers ?? !isReadOnlyObject;
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();

  const { t } = useI18n();
  const [id] = React.useState(generateHash());
  const [activeTabId, setActiveTabId] = React.useState<string>('1');
  const {
    loadTableColumns,
    loadTableReferences,
    loadTableUsedAsReference,
    loadTableRestrictions,
    loadTableDefinition,
    loadTableIndexes,
    loadTableTriggers,
  } = useTableInfoContext();

  const { state, register } = useForm({
    table: table || '',
    comment: '',
  });

  const tableName = isCreateMode ? state.table.trim() : table;

  const handleRefreshActiveTab = React.useCallback(() => {
    if (isCreateMode) return;

    const filters = { schema: props.schema, table };

    if (activeTabId === '1') return loadTableColumns(props.id_connection, filters);
    if (activeTabId === '8') return loadTableIndexes(props.id_connection, filters);
    if (activeTabId === '2') return loadTableRestrictions(props.id_connection, filters);
    if (activeTabId === '3') return loadTableReferences(props.id_connection, filters);
    if (activeTabId === '4') return loadTableUsedAsReference(props.id_connection, filters);
    if (activeTabId === '7') {
      loadTableReferences(props.id_connection, filters);
      return loadTableUsedAsReference(props.id_connection, filters);
    }
    if (activeTabId === '6') return loadTableTriggers(props.id_connection, filters);
    if (activeTabId === '5') return loadTableDefinition(props.id_connection, filters);
  }, [
    activeTabId,
    isCreateMode,
    loadTableColumns,
    loadTableDefinition,
    loadTableIndexes,
    loadTableReferences,
    loadTableRestrictions,
    loadTableTriggers,
    loadTableUsedAsReference,
    props.id_connection,
    props.schema,
    table,
  ]);

  React.useEffect(() => {
    props.onRegisterRefresh?.(handleRefreshActiveTab);
  }, [props.onRegisterRefresh, handleRefreshActiveTab]);

  const tabs = React.useMemo(() => {
    const allowedTabs = [{ idTab: '1', title: t('tabs.columns') }];

    if (supportsIndexes) {
      allowedTabs.push({ idTab: '8', title: t('tabs.indexes') });
    }

    if (!isReadOnlyObject) {
      allowedTabs.push(
        { idTab: '2', title: t('tabs.constraints') },
        { idTab: '3', title: t('tabs.foreignKeys') },
      );
    }

    if (!isCreateMode) {
      if (!isReadOnlyObject) {
        allowedTabs.push({ idTab: '4', title: t('tabs.references') });
      }

      if (supportsTriggers) {
        allowedTabs.push({ idTab: '6', title: t('tabs.triggers') });
      }

      if (!isReadOnlyObject) {
        allowedTabs.push({ idTab: '7', title: t('tabs.diagram') });
      }

      allowedTabs.push({ idTab: '5', title: t('tabs.definition') });
    }

    return allowedTabs;
  }, [isCreateMode, isReadOnlyObject, supportsIndexes, supportsTriggers, t]);

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
            label={t('field.table')}
            backgroundColor={theme.header.fieldBackgroundColor}
            color={theme.header.fieldColor}
            disabled={isReadOnlyObject}
            {...register('table')}
          />
          <Input
            md={6}
            label={t('field.comment')}
            backgroundColor={theme.header.fieldBackgroundColor}
            color={theme.header.fieldColor}
            disabled={isReadOnlyObject}
            {...register('comment')}
          />
        </Row>
      </div>

      <div
        className={styles.propertiesContent}
        style={{
          border: `1px 1px 1px 0 solid ${theme.bar.borderColor}`,
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

        <TabWindow activeTabId={activeTabId}>
          <TabContent idTab="1">
            <Columns {...props} table={tableName} tableComment={state.comment} />
          </TabContent>

          {supportsIndexes && (
            <TabContent idTab="8">
              <Indexes {...props} table={tableName} tableComment={state.comment} />
            </TabContent>
          )}

          {!isReadOnlyObject && (
            <TabContent idTab="2">
              <Restrictios {...props} table={tableName} tableComment={state.comment} />
            </TabContent>
          )}

          {!isReadOnlyObject && (
            <TabContent idTab="3">
              <ForeingKeys {...props} table={tableName} tableComment={state.comment} />
            </TabContent>
          )}

          {!isCreateMode && !isReadOnlyObject && (
            <TabContent idTab="4">
              <References {...props} />
            </TabContent>
          )}

          {!isCreateMode && !isReadOnlyObject && (
            <TabContent idTab="7">
              <Diagram active={activeTabId === '7'} {...props} />
            </TabContent>
          )}

          {!isCreateMode && (
            <TabContent idTab="5">
              <Definition {...props} />
            </TabContent>
          )}

          {!isCreateMode && supportsTriggers && (
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
