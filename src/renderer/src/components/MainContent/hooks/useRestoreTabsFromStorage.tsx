import React from 'react';
import { IAppTab, useAppTabContext } from '@renderer/contexts/AppTab';
import type { IAppTabsSession } from '@renderer/components/MainContent';
import { QueryEditor } from '@renderer/views/QueryEditor';
import TableInfo from '@renderer/views/TableInfo';
import FunctionInfo from '@renderer/views/FunctionInfo';

const APP_TABS_SESSION_STORAGE_KEY = 'app_tabs_session';

export const usRestoreTabsFromStorage = () => {
  const { restoreTabs } = useAppTabContext();

  React.useEffect(() => {
    const rawSession = window.localStorage.getItem(APP_TABS_SESSION_STORAGE_KEY);

    if (!rawSession) {
      restoreTabs([]);
      return;
    }

    try {
      const session = JSON.parse(rawSession) as IAppTabsSession;

      const restoredTabs: IAppTab[] = [];

      for (const tab of session.tabs || []) {
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

      restoreTabs(restoredTabs, session.activeTabId);
    } catch {
      restoreTabs([]);
    }
  }, []);
};
