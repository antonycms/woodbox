import React from 'react';
import { IAppTab, IAppTabGroup } from '@renderer/contexts/AppTab';
import { useStoreContext } from '@renderer/contexts/Store';
import { useToast } from '@renderer/contexts/Toast';
import { QueryEditor } from '@renderer/views/QueryEditor';
import TableInfo from '@renderer/views/TableInfo';
import FunctionInfo from '@renderer/views/FunctionInfo';
import { APP_TABS_SESSION_STORAGE_KEY, IAppTabsSession } from '../context';

export const useRestoreTabsFromStorage = (
  setActiveTabId: React.Dispatch<React.SetStateAction<string | undefined>>,
  setTabs: React.Dispatch<React.SetStateAction<IAppTab[]>>,
  setTabGroups: React.Dispatch<React.SetStateAction<IAppTabGroup[]>>,
) => {
  const { loadConnectionInfo } = useStoreContext();
  const { showToast } = useToast();

  const [hasRestoredTabs, setHasRestoredTabs] = React.useState(false);

  React.useEffect(() => {
    const rawSession = window.localStorage.getItem(APP_TABS_SESSION_STORAGE_KEY);

    if (!rawSession) {
      setHasRestoredTabs(true);
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

      const groupIdsWithTabs = new Set(restoredTabs.map((tab) => tab.groupId).filter(Boolean));
      const restoredGroups = (session.tabGroups || []).filter((group) =>
        groupIdsWithTabs.has(group.id),
      );
      const restoredGroupIds = new Set(restoredGroups.map((group) => group.id));
      const restoredTabsWithValidGroups = restoredTabs.map((tab) =>
        tab.groupId && !restoredGroupIds.has(tab.groupId) ? { ...tab, groupId: undefined } : tab,
      );
      const visibleTabs = restoredTabsWithValidGroups.filter((tab) => {
        const group = restoredGroups.find((item) => item.id === tab.groupId);

        return !group?.collapsed;
      });

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

      setTabs(restoredTabsWithValidGroups);
      setTabGroups(restoredGroups);

      setActiveTabId(
        visibleTabs.some((tab) => tab.id === session.activeTabId)
          ? session.activeTabId
          : visibleTabs[0]?.id,
      );
    } catch (error) {
      console.error(error);
    } finally {
      setHasRestoredTabs(true);
    }
  }, []);

  return hasRestoredTabs;
};
