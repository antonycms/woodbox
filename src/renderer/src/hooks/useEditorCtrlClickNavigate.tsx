import React from 'react';
import { useStoreContext } from '@renderer/contexts/Store';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import TableInfo from '@renderer/views/TableInfo';
import FunctionInfo from '@renderer/views/FunctionInfo';

const useEditorCtrlClickNavigate = (id_connection: string) => {
  const { connectionsInfo } = useStoreContext();
  const { addTab, getTab, setActiveTabId } = useAppTabContext();

  return React.useCallback(
    (word: string, schema?: string) => {
      const info = connectionsInfo.get(id_connection);
      if (!info) return;

      const tableMatch = info.tables.find(
        (t) => t.table_name === word && (!schema || t.table_schema === schema),
      );

      if (tableMatch) {
        const tableSchema = tableMatch.table_schema || 'public';
        const tabId = `${id_connection}_${tableSchema}_${tableMatch.table_name}`;
        if (getTab(tabId)) {
          setActiveTabId(tabId);
        } else {
          addTab({
            id: tabId,
            title: `${tableSchema ? `${tableSchema}.` : ''}${tableMatch.table_name}`,
            data: {
              type: 'table-info',
              id_connection,
              schema: tableSchema,
              table: tableMatch.table_name,
            },
            component: () => (
              <TableInfo
                id_connection={id_connection}
                schema={tableSchema}
                table={tableMatch.table_name}
              />
            ),
          });
        }
        return;
      }

      const fnMatch = info.functions.find(
        (f) => f.function_name === word && (!schema || f.function_schema === schema),
      );

      if (fnMatch) {
        const fnSchema = fnMatch.function_schema || 'public';
        const tabId = `fn_${id_connection}_${fnSchema}_${fnMatch.function_name}`;
        if (getTab(tabId)) {
          setActiveTabId(tabId);
        } else {
          addTab({
            id: tabId,
            title: `${fnSchema ? `${fnSchema}.` : ''}${fnMatch.function_name}`,
            data: {
              type: 'function-info',
              id_connection,
              schema: fnSchema,
              function_name: fnMatch.function_name,
            },
            component: () => (
              <FunctionInfo
                id_connection={id_connection}
                schema={fnSchema}
                function_name={fnMatch.function_name}
              />
            ),
          });
        }
      }
    },
    [id_connection, connectionsInfo, addTab, getTab, setActiveTabId],
  );
};

export default useEditorCtrlClickNavigate;
