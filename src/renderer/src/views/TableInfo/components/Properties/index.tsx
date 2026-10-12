import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import { Row } from '@renderer/components/Grid';
import { Input } from '@renderer/components/Input';
import { TabBar, TabContent, TabWindow } from '@renderer/components/Tabs';
import { generateHash } from '@shared/utils/string';
import { useForm } from '@renderer/hooks/useForm';
import { useThemeStore } from '@renderer/stores/Theme';
import { useTableInfoStore, type TableInfoStoreApi } from '@renderer/stores/TableInfo';
import { useI18nStore } from '@renderer/stores/I18n';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import Columns from './tabs/Columns';
import ForeignKeys from './tabs/ForeignKeys';
import Restrictions from './tabs/Restrictions';
import References from './tabs/References';
import Definition from './tabs/Definition';
import Triggers from './tabs/Triggers';
import Indexes from './tabs/Indexes';
import Diagram from './tabs/Diagram';
import styles from './styles.module.css';

interface IPropertiesProps {
  tableStore: TableInfoStoreApi;
  onRegisterRefresh?: (refresh: () => void | Promise<void>) => void;
  onPendingTablePropertiesChange?: (hasChanges: boolean) => void;
}

const normalizeComment = (value?: string) => value?.trim() || '';

const Properties = (props: IPropertiesProps) => {
  const {
    tableInfo: { properties: theme },
  } = useThemeStore((state) => state.activeTheme);

  const t = useI18nStore((state) => state.t);
  const { connectionsInfo, loadConnectionInfo } = useWorkspaceStore(
    useShallow((state) => ({
      connectionsInfo: state.connectionsInfo,
      loadConnectionInfo: state.loadConnectionInfo,
    })),
  );
  const {
    loadTableColumns,
    loadTableReferences,
    loadTableUsedAsReference,
    loadTableRestrictions,
    loadTableDefinition,
    loadTableIndexes,
    loadTableTriggers,
    setTableProperties,
    tableContext,
  } = useTableInfoStore(
    props.tableStore,
    useShallow((state) => ({
      loadTableColumns: state.loadTableColumns,
      loadTableReferences: state.loadTableReferences,
      loadTableUsedAsReference: state.loadTableUsedAsReference,
      loadTableRestrictions: state.loadTableRestrictions,
      loadTableDefinition: state.loadTableDefinition,
      loadTableIndexes: state.loadTableIndexes,
      loadTableTriggers: state.loadTableTriggers,
      setTableProperties: state.setTableProperties,
      tableContext: state.tableContext,
    })),
  );

  const {
    idConnection: id_connection,
    schema,
    table,
    mode,
    objectType,
    supportsIndexes,
    supportsTriggers,
    supportsTableComments: supportsTableCommentsFromContext,
  } = tableContext;
  const isCreateMode = mode === 'create';
  const isReadOnlyObject = objectType === 'view' || objectType === 'materialized_view';

  const [id] = React.useState(() => generateHash());
  const [activeTabId, setActiveTabId] = React.useState<string>('1');
  const tableFormRef = React.useRef({ table, comment: '' });
  const { state, register, setState } = useForm({
    table: table || '',
    comment: '',
  });

  const connectionInfo = connectionsInfo.get(id_connection);
  const currentTable = React.useMemo(() => {
    return connectionInfo?.tables.find(
      (item) => item.table_name === table && (item.table_schema || '') === (schema || ''),
    );
  }, [connectionInfo, schema, table]);
  const supportsTableComments =
    !isReadOnlyObject &&
    (supportsTableCommentsFromContext ??
      currentTable?.supports_table_comments ??
      connectionInfo?.supports_table_comments ??
      false);
  const originalComment = normalizeComment(currentTable?.comment);
  const normalizedTableName = state.table.trim();
  const tableNameChanged = !isCreateMode && normalizedTableName !== table;
  const tableCommentChanged =
    supportsTableComments && !isCreateMode && normalizeComment(state.comment) !== originalComment;

  const handleRefreshActiveTab = React.useCallback(() => {
    if (isCreateMode) return;

    const filters = { schema, table };

    if (activeTabId === '1') return loadTableColumns(id_connection, filters);
    if (activeTabId === '8') return loadTableIndexes(id_connection, filters);
    if (activeTabId === '2') return loadTableRestrictions(id_connection, filters);
    if (activeTabId === '3') return loadTableReferences(id_connection, filters);
    if (activeTabId === '4') return loadTableUsedAsReference(id_connection, filters);
    if (activeTabId === '7') {
      loadTableReferences(id_connection, filters);
      return loadTableUsedAsReference(id_connection, filters);
    }
    if (activeTabId === '6') return loadTableTriggers(id_connection, filters);
    if (activeTabId === '5') return loadTableDefinition(id_connection, filters);
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
    id_connection,
    schema,
    table,
  ]);

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

  React.useEffect(() => {
    props.onRegisterRefresh?.(handleRefreshActiveTab);
  }, [props.onRegisterRefresh, handleRefreshActiveTab]);

  React.useEffect(() => {
    if (isCreateMode) return;

    props.onPendingTablePropertiesChange?.(tableNameChanged || tableCommentChanged);
  }, [
    isCreateMode,
    props.onPendingTablePropertiesChange,
    tableCommentChanged,
    tableNameChanged,
  ]);

  React.useEffect(() => {
    setTableProperties({
      tableName: normalizedTableName,
      originalTableName: table || '',
      comment: state.comment,
      originalComment,
      supportsTableComments,
    });
  }, [
    normalizedTableName,
    originalComment,
    setTableProperties,
    state.comment,
    supportsTableComments,
    table,
  ]);

  React.useEffect(() => {
    if (!id_connection || connectionsInfo.has(id_connection)) return;

    void loadConnectionInfo(id_connection).catch(() => undefined);
  }, [connectionsInfo, loadConnectionInfo, id_connection]);

  React.useEffect(() => {
    if (isCreateMode) return;

    setState((prevState) => {
      const previousForm = tableFormRef.current;
      const tableChanged = previousForm.table !== table;
      const commentChanged = normalizeComment(prevState.comment) !== previousForm.comment;

      tableFormRef.current = { table, comment: originalComment };

      if (tableChanged) return { table: table || '', comment: originalComment };

      return {
        table: prevState.table,
        comment: commentChanged ? prevState.comment : originalComment,
      };
    });
  }, [isCreateMode, originalComment, setState, table]);

  return (
    <div className={styles.propertiesContainer}>
      <div
        className={styles.propertiesHeader}
        style={{ backgroundColor: theme.header.backgroundColor }}
      >
        <Row>
          <Input
            md={supportsTableComments ? 6 : 12}
            required
            label={t('field.table')}
            backgroundColor={theme.header.fieldBackgroundColor}
            color={theme.header.fieldColor}
            disabled={isReadOnlyObject}
            {...register('table')}
          />
          {supportsTableComments && (
            <Input
              md={6}
              label={t('field.comment')}
              backgroundColor={theme.header.fieldBackgroundColor}
              color={theme.header.fieldColor}
              {...register('comment')}
            />
          )}
        </Row>
      </div>

      <div
        className={styles.propertiesContent}
        style={{ borderTop: `2px solid ${theme.bar.borderColor}` }}
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

        <TabWindow>
          <TabContent activeTabId={activeTabId} idTab="1">
            <Columns tableStore={props.tableStore} />
          </TabContent>

          {supportsIndexes && (
            <TabContent activeTabId={activeTabId} idTab="8">
              <Indexes tableStore={props.tableStore} />
            </TabContent>
          )}

          {!isReadOnlyObject && (
            <TabContent activeTabId={activeTabId} idTab="2">
              <Restrictions tableStore={props.tableStore} />
            </TabContent>
          )}

          {!isReadOnlyObject && (
            <TabContent activeTabId={activeTabId} idTab="3">
              <ForeignKeys tableStore={props.tableStore} />
            </TabContent>
          )}

          {!isCreateMode && !isReadOnlyObject && (
            <TabContent activeTabId={activeTabId} idTab="4">
              <References tableStore={props.tableStore} />
            </TabContent>
          )}

          {!isCreateMode && !isReadOnlyObject && (
            <TabContent activeTabId={activeTabId} idTab="7">
              <Diagram tableStore={props.tableStore} active={activeTabId === '7'} />
            </TabContent>
          )}

          {!isCreateMode && (
            <TabContent activeTabId={activeTabId} idTab="5">
              <Definition tableStore={props.tableStore} />
            </TabContent>
          )}

          {!isCreateMode && supportsTriggers && (
            <TabContent activeTabId={activeTabId} idTab="6">
              <Triggers tableStore={props.tableStore} />
            </TabContent>
          )}
        </TabWindow>
      </div>
    </div>
  );
};

export default Properties;
