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
import { getRendererDialect } from '@renderer/database/dialects';
import ModalConfirmDiscardChanges from '@renderer/components/ModalConfirmDiscardChanges';
import {
  emitConfirmOpenTableWithFilter,
  TABLE_INFO_CONFIRM_OPEN_WITH_FILTER_EVENT,
  type TableInfoOpenWithFilterRequest,
} from './events';

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
  initialWhere: string;
};

const TableInfo = (props: ITableInfoViewProps) => {
  const { tableInfo: theme } = useThemeStore((state) => state.activeTheme);
  const {
    pendingColumns,
    pendingDroppedColumns,
    pendingChangedColumns,
    pendingIndexes,
    pendingDroppedIndexes,
    pendingRestrictions,
    pendingDroppedRestrictions,
    pendingReferences,
    pendingDroppedReferences,
  } = useTableInfoStore(
    props.tableStore,
    useShallow((state) => ({
      pendingColumns: state.pendingColumns,
      pendingDroppedColumns: state.pendingDroppedColumns,
      pendingChangedColumns: state.pendingChangedColumns,
      pendingIndexes: state.pendingIndexes,
      pendingDroppedIndexes: state.pendingDroppedIndexes,
      pendingRestrictions: state.pendingRestrictions,
      pendingDroppedRestrictions: state.pendingDroppedRestrictions,
      pendingReferences: state.pendingReferences,
      pendingDroppedReferences: state.pendingDroppedReferences,
    })),
  );
  const t = useI18nStore((state) => state.t);
  const { addTab, getTab, setActiveTabId, updateTab } = useAppTabStore(
    useShallow((state) => ({
      addTab: state.addTab,
      getTab: state.getTab,
      setActiveTabId: state.setActiveTabId,
      updateTab: state.updateTab,
    })),
  );
  const connections = useWorkspaceStore((state) => state.connections);
  const [id] = React.useState(generateHash());
  const [mode, setMode] = React.useState(props.mode || 'view');
  const [table, setTable] = React.useState(props.table);
  const [hasPendingRowsChanges, setHasPendingRowsChanges] = React.useState(false);
  const [pendingOpenTableWithFilter, setPendingOpenTableWithFilter] =
    React.useState<OpenTableWithFilterParams>();
  const [activeTableInfoTabId, setActiveTableInfoTabId] = React.useState(
    props.initialTab || 'tabProperties',
  );
  const propertiesRefreshRef = React.useRef<(() => void | Promise<void>) | undefined>(undefined);
  const dataRefreshRef = React.useRef<(() => void | Promise<void>) | undefined>(undefined);
  const isCreateMode = mode === 'create';

  const tabsProps = React.useMemo(() => ({ ...props, mode, table }), [mode, props, table]);
  const hasPendingTableInfoChanges = React.useMemo(
    () =>
      [
        pendingColumns,
        pendingDroppedColumns,
        pendingChangedColumns,
        pendingIndexes,
        pendingDroppedIndexes,
        pendingRestrictions,
        pendingDroppedRestrictions,
        pendingReferences,
        pendingDroppedReferences,
      ].some((items) => items.length > 0),
    [
      pendingColumns,
      pendingDroppedColumns,
      pendingChangedColumns,
      pendingIndexes,
      pendingDroppedIndexes,
      pendingRestrictions,
      pendingDroppedRestrictions,
      pendingReferences,
      pendingDroppedReferences,
    ],
  );
  const dialect = React.useMemo(
    () =>
      getRendererDialect(
        connections.find((connection) => connection.id === props.id_connection)?.dialect,
      ),
    [connections, props.id_connection],
  );

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

  const handleOpenTableSimple = React.useCallback(
    (idConnection: string, schema: string, table: string) => {
      const tabId = `${idConnection}_${schema}_${table}`;
      if (getTab(tabId)) {
        setActiveTabId(tabId);
      } else {
        addTab({
          id: tabId,
          title: `${schema ? `${schema}.` : ''}${table}`,
          data: {
            type: 'table-info',
            id_connection: idConnection,
            schema,
            table,
          },
          component: () => (
            <TableInfoWithStore
              id_connection={idConnection}
              schema={schema}
              table={table}
              appTabId={tabId}
            />
          ),
        });
      }
    },
    [addTab, getTab, setActiveTabId],
  );

  const applyTableDataTabWithFilter = React.useCallback(
    (params: OpenTableWithFilterParams, force = false) => {
      const { idConnection, schema, table, initialWhere } = params;
      const tabId = `${idConnection}_${schema}_${table}`;
      const existingTab = getTab(tabId);

      if (existingTab?.unsaved && !force) {
        setActiveTabId(tabId);
        emitConfirmOpenTableWithFilter({ ...params, tabId });
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
      setPendingOpenTableWithFilter(undefined);
    },
    [addTab, getTab, setActiveTabId],
  );

  const handleOpenTable = React.useCallback(
    (
      idConnection: string,
      schema: string,
      table: string,
      filterColumn: string,
      filterValue: string,
    ) => {
      const escapedValue = filterValue.replace(/'/g, "''");
      const initialWhere = `${dialect.quoteIdent(filterColumn)} = '${escapedValue}'`;
      applyTableDataTabWithFilter({ idConnection, schema, table, initialWhere });
    },
    [applyTableDataTabWithFilter, dialect],
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
    if (!props.appTabId) return;

    updateTab(props.appTabId, {
      unsaved: mode === 'create' || hasPendingRowsChanges || hasPendingTableInfoChanges,
    });
  }, [hasPendingRowsChanges, hasPendingTableInfoChanges, mode, props.appTabId, updateTab]);

  React.useEffect(() => {
    const currentTabId = props.appTabId || `${props.id_connection}_${props.schema}_${table}`;
    const handleConfirmOpenWithFilter = (event: Event) => {
      const { detail } = event as CustomEvent<TableInfoOpenWithFilterRequest>;

      if (detail.tabId !== currentTabId) return;

      setPendingOpenTableWithFilter(detail);
      setActiveTableInfoTabId('tabData');
    };

    window.addEventListener(TABLE_INFO_CONFIRM_OPEN_WITH_FILTER_EVENT, handleConfirmOpenWithFilter);

    return () =>
      window.removeEventListener(
        TABLE_INFO_CONFIRM_OPEN_WITH_FILTER_EVENT,
        handleConfirmOpenWithFilter,
      );
  }, [props.appTabId, props.id_connection, props.schema, table]);

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
            {...tabsProps}
            onOpenTable={handleOpenTableSimple}
            onCreateApplied={handleCreateApplied}
            onRegisterRefresh={(refresh) => {
              propertiesRefreshRef.current = refresh;
            }}
          />
        </TabContent>

        {!isCreateMode && (
          <TabContent activeTabId={activeTableInfoTabId} idTab="tabData">
            <Data
              {...tabsProps}
              onOpenTable={handleOpenTable}
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
        onCancel={() => setPendingOpenTableWithFilter(undefined)}
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
  const [tableStore] = React.useState(createTableInfoStore);
  return (
    <>
      <TableInfo {...props} tableStore={tableStore} />
      <PendingDdlModal tableStore={tableStore} />
    </>
  );
};

export default TableInfoWithStore;
