import { getErrorMessage } from '@shared/utils/error';
import React from 'react';
import { IAppTab } from '@renderer/stores/AppTab/types';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { useI18nStore } from '@renderer/stores/I18n';
import { useAppTabStore } from '@renderer/stores/AppTab';
import { readStorageValue } from '@renderer/utils/storage';
import { useToastStore } from '@renderer/stores/Toast';
import { QueryEditor } from '@renderer/views/QueryEditor';
import TableInfo from '@renderer/views/TableInfo';
import FunctionInfo from '@renderer/views/FunctionInfo';
import ProcessList from '@renderer/views/ProcessList';
import { APP_TABS_SESSION_STORAGE_KEY, IAppTabsSession } from '@renderer/stores/AppTab/types';

export const useRestoreTabsFromStorage = () => {
  const restoreSession = useAppTabStore((state) => state.restoreSession);
  const loadConnectionInfo = useWorkspaceStore((state) => state.loadConnectionInfo);
  const showToast = useToastStore((state) => state.showToast);
  const t = useI18nStore((state) => state.t);

  const [hasRestoredTabs, setHasRestoredTabs] = React.useState(false);

  React.useEffect(() => {
    const session = readStorageValue<IAppTabsSession | null>(APP_TABS_SESSION_STORAGE_KEY, null);

    if (!session) {
      setHasRestoredTabs(true);
      return;
    }

    try {
      const restoredTabs: IAppTab[] = [];
      const connectionIds = new Set<string>();

      for (const tab of session.tabs || []) {
        if (tab.data && 'id_connection' in tab.data) {
          connectionIds.add(tab.data.id_connection);
        }

        if (tab.data?.type === 'query-editor') {
          const { id_connection, id_script } = tab.data;

          restoredTabs.push({
            ...tab,
            component: ({ isActiveTab }) => <QueryEditor isActiveTab={isActiveTab} id_connection={id_connection} id_script={id_script} />,
          });
        }

        if (tab.data?.type === 'table-info') {
          const {
            id_connection,
            schema,
            table,
            initialWhere,
            filterLocked,
            initialTab,
            objectType,
            supportsIndexes,
            supportsTriggers,
          } = tab.data;

          restoredTabs.push({
            ...tab,
            title: `${schema ? `${schema}.` : ''}${table}`,
            component: () => (
              <TableInfo
                id_connection={id_connection}
                schema={schema}
                table={table}
                appTabId={tab.id}
                initialWhere={initialWhere}
                filterLocked={filterLocked}
                initialTab={initialTab}
                objectType={objectType}
                supportsIndexes={supportsIndexes}
                supportsTriggers={supportsTriggers}
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

        if (tab.data?.type === 'process-list') {
          const { id_connection } = tab.data;

          restoredTabs.push({
            ...tab,
            title: t('processList.title'),
            component: () => <ProcessList id_connection={id_connection} />,
          });
        }
      }

      Promise.allSettled([...connectionIds].map((id) => loadConnectionInfo(id))).then((results) => {
        results.forEach((result) => {
          if (result.status === 'rejected') {
            showToast({
              type: 'error',
              title: t('toast.restoreConnectionError'),
              description: getErrorMessage(result.reason, t('common.unknownError')),
            });
          }
        });
      });

      restoreSession({
        tabs: restoredTabs,
        tabGroups: session.tabGroups,
        activeTabId: session.activeTabId,
      });
    } catch (error) {
      console.error(error);
    } finally {
      setHasRestoredTabs(true);
    }
  }, []);

  return hasRestoredTabs;
};
