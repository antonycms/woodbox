import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import { useAppTabStore } from '@renderer/stores/AppTab';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { getRendererDialect } from '@renderer/database/dialects';
import TableInfo from '@renderer/views/TableInfo';
import { requestOpenTableWithFilter } from '@renderer/views/TableInfo/openWithFilterRequest';

interface IOpenTableOptions {
  initialWhere?: string;
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
  const connections = useWorkspaceStore((state) => state.connections);

  const openTable = React.useCallback(
    (idConnection: string, schema: string | undefined, table: string, options?: IOpenTableOptions) => {
      const tabId = `${idConnection}_${schema}_${table}`;
      const existingTab = getTab(tabId);
      const initialTab = options?.initialTab || (options?.initialWhere ? 'tabData' : undefined);

      if (options?.initialWhere && existingTab?.unsaved) {
        setActiveTabId(tabId);
        requestOpenTableWithFilter({
          tabId,
          idConnection,
          schema,
          table,
          initialWhere: options.initialWhere,
        });
        return;
      }

      if (existingTab && !options?.initialWhere) {
        setActiveTabId(tabId);
        return;
      }

      addTab({
        id: tabId,
        replaceId: options?.initialWhere ? existingTab?.id : undefined,
        groupId: options?.initialWhere ? existingTab?.groupId : undefined,
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
    (
      idConnection: string,
      schema: string | undefined,
      table: string,
      filterColumn: string,
      filterValue: string,
    ) => {
      const dialect = getRendererDialect(
        connections.find((connection) => connection.id === idConnection)?.dialect,
      );
      const escapedValue = filterValue.replace(/'/g, "''");
      const initialWhere = `${dialect.quoteIdent(filterColumn)} = '${escapedValue}'`;

      openTable(idConnection, schema, table, { initialWhere, initialTab: 'tabData' });
    },
    [connections, openTable],
  );

  return { openTable, openTableWithFilter };
};
