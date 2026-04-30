import React from 'react';
import { IAppTab, useAppTabContext } from '@renderer/contexts/AppTab';
import { useStoreContext } from '@renderer/contexts/Store';
import { useToast } from '@renderer/contexts/Toast';
import type { IAppTabsSession } from '@renderer/components/MainContent';
import { QueryEditor } from '@renderer/views/QueryEditor';
import TableInfo from '@renderer/views/TableInfo';
import FunctionInfo from '@renderer/views/FunctionInfo';

const APP_TABS_SESSION_STORAGE_KEY = 'app_tabs_session';

export const usRestoreTabsFromStorage = () => {
  const { restoreTabs } = useAppTabContext();
  const { loadConnectionInfo } = useStoreContext();
  const { showToast } = useToast();

  React.useEffect(() => {
    const rawSession = window.localStorage.getItem(APP_TABS_SESSION_STORAGE_KEY);

    if (!rawSession) {
      restoreTabs([]);
      return;
    }

    try {
      const session = JSON.parse(rawSession) as IAppTabsSession;

      const restoredTabs: IAppTab[] = [];
      const connectionIds = new Set<string>();

      for (const tab of session.tabs || []) {
        if (tab.data?.id_connection) {
          connectionIds.add(tab.data.id_connection);
        }

        if (tab.data?.type === 'query-editor') {
          const { id_connection, id_script } = tab.data;

          restoredTabs.push({
            ...tab,
            component: () => <QueryEditor id_connection={id_connection} id_script={id_script} />,
          });
        }

        if (tab.data?.type === 'table-info') {
          const { id_connection, schema, table, initialWhere, filterLocked, initialTab } = tab.data;

          restoredTabs.push({
            ...tab,
            title: `${schema ? `${schema}.` : ''}${table}`,
            component: () => (
              <TableInfo
                id_connection={id_connection}
                schema={schema}
                table={table}
                initialWhere={initialWhere}
                filterLocked={filterLocked}
                initialTab={initialTab}
              />
            ),
          });
        }

        if (tab.data?.type === 'function-info') {
          const { id_connection, schema, function_name } = tab.data;

          restoredTabs.push({
            ...tab,
            title: `${schema ? `${schema}.` : ''}${function_name}`,
            component: () => (
              <FunctionInfo
                id_connection={id_connection}
                schema={schema}
                function_name={function_name}
              />
            ),
          });
        }
      }

      Promise.allSettled([...connectionIds].map((id) => loadConnectionInfo(id))).then((results) => {
        results.forEach((result) => {
          if (result.status === 'rejected') {
            showToast({
              type: 'error',
              title: 'Erro ao restaurar conexão',
              description: result.reason?.message,
            });
          }
        });
      });

      restoreTabs(restoredTabs, session.activeTabId);
    } catch {
      restoreTabs([]);
    }
  }, []);
};
