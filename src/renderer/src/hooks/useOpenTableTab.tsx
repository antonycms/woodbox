import type { InitialWhere } from '@shared/types/database';
import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import { useAppTabStore } from '@renderer/stores/AppTab';
import TableInfo from '@renderer/views/TableInfo';
import { requestOpenTableWithFilter } from '@renderer/views/TableInfo/openWithFilterRequest';

interface IOpenTableOptions {
  initialWhere?: InitialWhere;
  initialTab?: string;
}

export const useOpenTableTab = () => {
  const { addTab, getTab, setActiveTabId } = useAppTabStore(
    useShallow((state) => ({
      addTab: state.addTab,
      getTab: state.getTab,
      setActiveTabId: state.setActiveTabId,
    })),
  );

  const openTable = React.useCallback(
    (idConnection: string, schema: string | undefined, table: string, options?: IOpenTableOptions) => {
      const filtered = !!options?.initialWhere;
      const tabId = `${idConnection}_${schema}_${table}`;
      const existingTab = getTab(tabId);
      const initialTab = options?.initialTab || (filtered ? 'tabData' : undefined);

      if (filtered && existingTab?.unsaved) {
        setActiveTabId(tabId);
        requestOpenTableWithFilter({
          tabId,
          idConnection,
          schema,
          table,
          initialWhere: options?.initialWhere,
        });
        return;
      }

      if (existingTab && !filtered) {
        setActiveTabId(tabId);
        return;
      }

      addTab({
        id: tabId,
        replaceId: filtered ? existingTab?.id : undefined,
        groupId: filtered ? existingTab?.groupId : undefined,
        title: `${schema ? `${schema}.` : ''}${table}`,
        data: {
          type: 'table-info',
          id_connection: idConnection,
          schema,
          table,
          initialWhere: options?.initialWhere,
          initialTab,
        },
        component: () => (
          <TableInfo
            id_connection={idConnection}
            schema={schema}
            table={table}
            appTabId={tabId}
            initialWhere={options?.initialWhere}
            initialTab={initialTab}
          />
        ),
      });
    },
    [addTab, getTab, setActiveTabId],
  );

  const openTableWithFilter = React.useCallback(
    (idConnection: string, schema: string | undefined, table: string, filterColumn: string, filterValue: unknown) => {
      openTable(idConnection, schema, table, { initialWhere: { column: filterColumn, value: structuredClone(filterValue) }, initialTab: 'tabData' });
    },
    [openTable],
  );

  return { openTable, openTableWithFilter };
};
