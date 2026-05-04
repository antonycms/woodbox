import React from 'react';
import { IAppTab } from '@renderer/contexts/AppTab';
import { useStoreContext } from '@renderer/contexts/Store';
import { useToast } from '@renderer/contexts/Toast';
import { QueryEditor } from '@renderer/views/QueryEditor';
import TableInfo from '@renderer/views/TableInfo';
import FunctionInfo from '@renderer/views/FunctionInfo';
import { APP_TABS_SESSION_STORAGE_KEY, IAppTabsSession } from '../context';

export const useRestoreTabsFromStorage = (
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>,
  setTabs: React.Dispatch<React.SetStateAction<IAppTab[]>>,
) => {
  const { loadConnectionInfo } = useStoreContext();
  const { showToast } = useToast();

  const hasRestoredTabsRef = React.useRef(false);

  React.useEffect(() => {
    const rawSession = window.localStorage.getItem(APP_TABS_SESSION_STORAGE_KEY);

    if (!rawSession) return;

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

      setTabs(restoredTabs);

      setActiveTabId(
        restoredTabs.some((tab) => tab.id === session.activeTabId)
          ? session.activeTabId
          : restoredTabs[0]?.id,
      );
    } catch (error) {
      console.error(error);
    } finally {
      hasRestoredTabsRef.current = true;
    }
  }, []);

  return hasRestoredTabsRef.current;
};
