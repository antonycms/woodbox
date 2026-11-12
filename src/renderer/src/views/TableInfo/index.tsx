import { bindTableInfoTab } from '@renderer/stores/TableInfo/tabOwner';
import type { InitialWhere } from '@shared/types/database';
import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import { TabBar, TabWindow, TabContent } from '@renderer/components/Tabs';
import { generateHash } from '@shared/utils/string';
import { createTableInfoStore, useTableInfoStore } from '@renderer/stores/TableInfo';
import { PendingDdlModal } from './components/PendingDdlModal';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { useAppTabStore } from '@renderer/stores/AppTab';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { selectConnectionPresentations } from '@renderer/stores/Workspace/selectors';
import ModalConfirmDiscardChanges from '@renderer/components/ModalConfirmDiscardChanges';
import {
  requestOpenTableWithFilter,
  useTableInfoOpenWithFilterRequestStore,
} from './openWithFilterRequest';

import Data from './components/Data';
import Properties from './components/Properties';
import styles from './styles.module.css';
import { ITableInfoProps, ITableInfoViewProps } from './dtos';

import IconFaRegularListAlt from '~icons/fa-regular/list-alt';
import IconFaSolidGripLines from '~icons/fa-solid/grip-lines';

type OpenTableWithFilterParams = {
  idConnection: string;
  schema?: string;
  table: string;
  initialWhere?: InitialWhere;
};

const TableInfo = (props: ITableInfoViewProps) => {
  const t = useI18nStore((state) => state.t);
  const { tableInfo: theme } = useThemeStore((state) => state.activeTheme);
  const {
    setTableContext,
    setTableAppliedHandler,
  } = useTableInfoStore(
    props.tableStore,
    useShallow((state) => ({
      setTableContext: state.setTableContext,
      setTableAppliedHandler: state.setTableAppliedHandler,
    })),
  );
  const { addTab, getTab, setActiveTabId } = useAppTabStore(
    useShallow((state) => ({
      addTab: state.addTab,
      getTab: state.getTab,
      setActiveTabId: state.setActiveTabId,
    })),
  );
  const { connectionsInfo, loadConnectionInfo } = useWorkspaceStore(
    useShallow((state) => ({
      connectionsInfo: state.connectionsInfo,
      loadConnectionInfo: state.loadConnectionInfo,
    })),
  );
  const connectionDialect = useWorkspaceStore(
    (state) => selectConnectionPresentations(state).get(props.id_connection)?.dialect,
  );
  const requestedOpenTableWithFilter = useTableInfoOpenWithFilterRequestStore(
    (state) => state.pendingRequest,
  );
  const clearOpenWithFilterRequest = useTableInfoOpenWithFilterRequestStore(
    (state) => state.clearOpenWithFilterRequest,
  );
  const [id] = React.useState(() => generateHash());
  const [mode, setMode] = React.useState(props.mode || 'view');
  const [table, setTable] = React.useState(props.table);
  const [activeTableInfoTabId, setActiveTableInfoTabId] = React.useState(
    props.initialTab || 'tabProperties',
  );
  const ownerRef = React.useRef<ReturnType<typeof bindTableInfoTab> | undefined>(undefined);
  const setHasPendingRowsChanges = React.useCallback((value: boolean) => ownerRef.current?.setRowsChanged(value), []);
  const setHasPendingTablePropertiesChanges = React.useCallback((value: boolean) => ownerRef.current?.setPropertiesChanged(value), []);
  const propertiesRefreshRef = React.useRef<(() => void | Promise<void>) | undefined>(undefined);
  const dataRefreshRef = React.useRef<(() => void | Promise<void>) | undefined>(undefined);

  const isCreateMode = mode === 'create';
  const connectionInfo = connectionsInfo.get(props.id_connection);
  const currentTabId = props.appTabId || `${props.id_connection}_${props.schema}_${table}`;

  const dialect = connectionDialect || 'postgres';

  const currentTable = React.useMemo(() => {
    return connectionInfo?.tables.find(
      (item) => item.table_name === table && (item.table_schema || '') === (props.schema || ''),
    );
  }, [connectionInfo, props.schema, table]);

  const objectType = currentTable?.object_type || 'table';
  const isReadOnlyObject = objectType === 'view' || objectType === 'materialized_view';
  const supportsIndexes = currentTable?.supports_indexes ?? !isReadOnlyObject;
  const supportsTriggers = currentTable?.supports_triggers ?? !isReadOnlyObject;
  const supportsTableComments =
    currentTable?.supports_table_comments ?? connectionInfo?.supports_table_comments ?? false;

  const pendingOpenTableWithFilter = React.useMemo(() => {
    if (requestedOpenTableWithFilter?.tabId !== currentTabId) return undefined;

    return requestedOpenTableWithFilter;
  }, [currentTabId, requestedOpenTableWithFilter]);

  const handleCreateApplied = React.useCallback(
    (createdTable: string) => {
      const tabId = `${props.id_connection}_${props.schema}_${createdTable}`;
      const title = `${props.schema ? `${props.schema}.` : ''}${createdTable}`;

      if (props.draftTabId) {
        addTab({
          replaceId: props.draftTabId,
          id: tabId,
          title,
          unsaved: false,
          data: {
            type: 'table-info',
            id_connection: props.id_connection,
            schema: props.schema,
            table: createdTable,
          },
          component: () => (
            <TableInfoWithStore
              id_connection={props.id_connection}
              schema={props.schema}
              table={createdTable}
              appTabId={tabId}
            />
          ),
        });

        return;
      }

      setTable(createdTable);
      setMode('view');
    },
    [addTab, props.draftTabId, props.id_connection, props.schema],
  );

  const handleTableApplied = React.useCallback(
    (appliedTable: string) => {
      setHasPendingTablePropertiesChanges(false);

      if (!appliedTable || appliedTable === table) return;

      const oldTabId = props.appTabId || `${props.id_connection}_${props.schema}_${table}`;
      const newTabId = `${props.id_connection}_${props.schema}_${appliedTable}`;
      const title = `${props.schema ? `${props.schema}.` : ''}${appliedTable}`;
      const currentTab = getTab(oldTabId);

      if (!currentTab) {
        setTable(appliedTable);
        return;
      }

      const currentInitialWhere = currentTab.data?.type === 'table-info'
        ? currentTab.data.initialWhere : props.initialWhere;
      addTab({
        replaceId: oldTabId,
        id: newTabId,
        groupId: currentTab.groupId,
        title,
        data: {
          type: 'table-info',
          id_connection: props.id_connection,
          schema: props.schema,
          table: appliedTable,
          initialWhere: currentInitialWhere,
          filterLocked: props.filterLocked,
          initialTab: activeTableInfoTabId,
        },
        component: () => (
          <TableInfoWithStore
            id_connection={props.id_connection}
            schema={props.schema}
            table={appliedTable}
            appTabId={newTabId}
            initialWhere={currentInitialWhere}
            filterLocked={props.filterLocked}
            initialTab={activeTableInfoTabId}
          />
        ),
      });
    },
    [
      addTab,
      activeTableInfoTabId,
      getTab,
      props.appTabId,
      props.filterLocked,
      props.id_connection,
      props.initialWhere,
      props.schema,
      table,
    ],
  );

  const applyTableDataTabWithFilter = React.useCallback(
    (params: OpenTableWithFilterParams, force = false) => {
      const { idConnection, schema, table, initialWhere } = params;
      const tabId = `${idConnection}_${schema}_${table}`;
      const existingTab = getTab(tabId);

      if (existingTab?.unsaved && !force) {
        setActiveTabId(tabId);
        requestOpenTableWithFilter({ ...params, tabId });
        return;
      }

      addTab({
        id: tabId,
        replaceId: existingTab?.id,
        groupId: existingTab?.groupId,
        title: `${schema ? `${schema}.` : ''}${table}`,
        data: {
          type: 'table-info',
          id_connection: idConnection,
          schema,
          table,
          initialWhere,
          initialTab: 'tabData',
        },
        component: () => (
          <TableInfoWithStore
            id_connection={idConnection}
            schema={schema}
            table={table}
            appTabId={tabId}
            initialWhere={initialWhere}
            initialTab="tabData"
          />
        ),
      });
      clearOpenWithFilterRequest();
    },
    [addTab, clearOpenWithFilterRequest, getTab, setActiveTabId],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'F5') return;

      event.preventDefault();

      if (activeTableInfoTabId === 'tabProperties') {
        propertiesRefreshRef.current?.();
        return;
      }

      if (activeTableInfoTabId === 'tabData') {
        dataRefreshRef.current?.();
      }
    },
    [activeTableInfoTabId],
  );

  React.useEffect(() => {
    const owner = bindTableInfoTab(props.tableStore, props.appTabId);
    ownerRef.current = owner;
    return () => { owner.dispose(); if (ownerRef.current === owner) ownerRef.current = undefined; };
  }, [props.appTabId, props.tableStore]);

  React.useEffect(() => {
    setTableAppliedHandler(isCreateMode ? handleCreateApplied : handleTableApplied);
  }, [handleCreateApplied, handleTableApplied, isCreateMode, setTableAppliedHandler]);

  React.useEffect(() => {
    setTableContext({
      idConnection: props.id_connection,
      schema: props.schema || '',
      table,
      mode,
      objectType,
      supportsIndexes,
      supportsTriggers,
      supportsTableComments,
      dialect,
    });
  }, [
    dialect,
    mode,
    objectType,
    props.id_connection,
    props.schema,
    setTableContext,
    supportsIndexes,
    supportsTableComments,
    supportsTriggers,
    table,
  ]);

  React.useEffect(() => {
    if (connectionsInfo.has(props.id_connection)) return;

    void loadConnectionInfo(props.id_connection).catch(() => undefined);
  }, [connectionsInfo, loadConnectionInfo, props.id_connection]);


  React.useEffect(() => {
    if (!pendingOpenTableWithFilter) return;

    setActiveTableInfoTabId('tabData');
  }, [pendingOpenTableWithFilter]);

  return (
    <div className={styles.container} onKeyDown={handleKeyDown}>
      <TabBar
        borderBottom
        idTabBar={id}
        activeTabId={activeTableInfoTabId}
        onActiveTab={(tab) => setActiveTableInfoTabId(tab?.idTab)}
        ascentColor={theme.tab.ascentColor}
        backgroundColor={theme.tab.backgroundColor}
        backgroundColorBar={theme.tab.bar.backgroundColor}
        borderColor={theme.tab.borderColor}
        color={theme.tab.color}
        tabs={[
          {
            idTab: 'tabProperties',
            title: t('tabs.properties'),
            icon: () => <IconFaSolidGripLines className={styles.icon} width={12} height={12} />,
          },
          !isCreateMode && {
            idTab: 'tabData',
            title: t('tabs.data'),
            icon: () => <IconFaRegularListAlt className={styles.icon} width={12} height={12} />,
          },
        ].filter(Boolean)}
      />

      <TabWindow>
        <TabContent activeTabId={activeTableInfoTabId} idTab="tabProperties">
          <Properties
            tableStore={props.tableStore}
            onPendingTablePropertiesChange={setHasPendingTablePropertiesChanges}
            onRegisterRefresh={(refresh) => {
              propertiesRefreshRef.current = refresh;
            }}
          />
        </TabContent>

        {!isCreateMode && (
          <TabContent activeTabId={activeTableInfoTabId} idTab="tabData">
            <Data
              tableStore={props.tableStore}
              initialWhere={props.initialWhere}
              filterLocked={props.filterLocked}
              onPendingRowsChangesChange={setHasPendingRowsChanges}
              onRegisterRefresh={(refresh) => {
                dataRefreshRef.current = refresh;
              }}
            />
          </TabContent>
        )}
      </TabWindow>

      <ModalConfirmDiscardChanges
        show={!!pendingOpenTableWithFilter}
        onCancel={clearOpenWithFilterRequest}
        onConfirm={() => {
          if (pendingOpenTableWithFilter) {
            applyTableDataTabWithFilter(pendingOpenTableWithFilter, true);
          }
        }}
      />
    </div>
  );
};

const TableInfoWithStore = (props: ITableInfoProps) => {
  const [tableStore] = React.useState(() => {
    const store = createTableInfoStore();

    store.getState().setTableContext({
      idConnection: props.id_connection,
      schema: props.schema || '',
      table: props.table,
      mode: props.mode || 'view',
    });

    return store;
  });

  return (
    <>
      <TableInfo {...props} tableStore={tableStore} />
      <PendingDdlModal tableStore={tableStore} />
    </>
  );
};

export default TableInfoWithStore;
