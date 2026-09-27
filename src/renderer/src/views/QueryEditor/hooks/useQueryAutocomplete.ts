import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Dialect } from '@shared/types/connections';
import type { IColumnInfo, IColumnReferenceInfo } from '@shared/types/database';
import type { IDefineSQlAutocompleteParams } from '@renderer/components/Editor/autocompleteDefault';
import { useDatabaseStore } from '@renderer/stores/Database';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { useSnippetsStore } from '@renderer/stores/Snippets';
import { getTablesFromQuerySql, type ITableQuery } from '@renderer/utils/sql';
import { isSnippetAvailableForDialect } from '@renderer/utils/snippets';
import { arrayIsEquals } from '@renderer/utils/array';
import { executePromisesBatch } from '@renderer/utils/promise';

export const useQueryAutocomplete = (id_connection: string, dialect: Dialect) => {
  const { getTableColumns, getTableReferences } = useDatabaseStore(
    useShallow((state) => ({
      getTableColumns: state.getTableColumns,
      getTableReferences: state.getTableReferences,
    })),
  );
  const connectionsInfo = useWorkspaceStore((state) => state.connectionsInfo);
  const snippets = useSnippetsStore((state) => state.snippets);
  const loadingColumnsKeysRef = React.useRef(new Set<string>());

  const loadingReferencesKeysRef = React.useRef(new Set<string>());

  const [currentQueryTablesInfo, setCurrentQueryTablesInfo] = React.useState<ITableQuery[]>([]);

  const [tableColumns, setTableColumns] = React.useState<Map<string, IColumnInfo[]>>(new Map());

  const [tableReferences, setTableReferences] = React.useState<Map<string, IColumnReferenceInfo[]>>(
    new Map(),
  );

  const tableColumnsRef = React.useRef(tableColumns);
  tableColumnsRef.current = tableColumns;

  const tableReferencesRef = React.useRef(tableReferences);
  tableReferencesRef.current = tableReferences;

  const getTableInfoKey = ({ name, schema }: ITableQuery) => `${schema ? schema + '.' : ''}${name}`;

  const loadTableColumns = React.useCallback(async () => {
    const pendingTables = new Map<string, ITableQuery>();

    for (const tableInfo of currentQueryTablesInfo) {
      const key = getTableInfoKey(tableInfo);

      const isPending =
        !tableColumnsRef.current.has(key) && !loadingColumnsKeysRef.current.has(key);

      if (isPending) {
        loadingColumnsKeysRef.current.add(key);
        pendingTables.set(key, tableInfo);
      }
    }

    if (!pendingTables.size) return;

    try {
      const results = await executePromisesBatch(
        [...pendingTables.entries()],
        async ([key, tableInfo]) => {
          const columns = await getTableColumns(id_connection, {
            schema: tableInfo.schema,
            table: tableInfo.name,
          });

          return { key, columns };
        },
      );

      setTableColumns((prevState) => {
        const newState = new Map(prevState);
        results.forEach(({ key, columns }) => newState.set(key, columns));
        return newState;
      });
    } finally {
      pendingTables.forEach((_, key) => loadingColumnsKeysRef.current.delete(key));
    }
  }, [currentQueryTablesInfo, getTableColumns, id_connection]);

  const loadTableReferences = React.useCallback(async () => {
    const pendingTables = new Map<string, ITableQuery>();

    for (const tableInfo of currentQueryTablesInfo) {
      const key = getTableInfoKey(tableInfo);

      const isPending =
        !tableReferencesRef.current.has(key) && !loadingReferencesKeysRef.current.has(key);

      if (isPending) {
        loadingReferencesKeysRef.current.add(key);
        pendingTables.set(key, tableInfo);
      }
    }

    if (!pendingTables.size) return;

    try {
      const results = await executePromisesBatch(
        [...pendingTables.entries()],
        async ([key, tableInfo]) => {
          const references = await getTableReferences(id_connection, {
            schema: tableInfo.schema,
            table: tableInfo.name,
          });

          return { key, references };
        },
      );

      setTableReferences((prevState) => {
        const newState = new Map(prevState);
        results.forEach(({ key, references }) => newState.set(key, references));
        return newState;
      });
    } finally {
      pendingTables.forEach((_, key) => loadingReferencesKeysRef.current.delete(key));
    }
  }, [currentQueryTablesInfo, getTableReferences, id_connection]);

  const handleUpdateCurrentQueryInfo = React.useCallback((query: string) => {
    const tablesQueryInfo = getTablesFromQuerySql(query);

    setCurrentQueryTablesInfo((prevState) => {
      // avoid changing the state memory address if there are no changes (prevent rerendering)
      const checkIsEquals = arrayIsEquals(prevState, tablesQueryInfo);
      return checkIsEquals ? prevState : tablesQueryInfo;
    });
  }, []);

  const autocomplete = React.useMemo<IDefineSQlAutocompleteParams>(() => {
    const snippetsAvailable = snippets.filter((snippet) =>
      isSnippetAvailableForDialect(snippet, dialect),
    );
    const connectionInfo = connectionsInfo.get(id_connection);

    if (!connectionInfo) return { snippets: snippetsAvailable };

    const schemas = connectionInfo.schemas || [];
    const tables = connectionInfo.tables || [];
    const functions = connectionInfo.functions || [];

    const schemasSerialized = schemas.map((schema) => ({ name: schema }));
    const tablesAvailable = tables.map((table) => ({
      name: table.table_name,
      schema: table.table_schema,
    }));
    const functionsAvailable = functions.map((fn) => ({
      name: fn.function_name,
      schema: fn.function_schema,
    }));
    const tablesUsed = currentQueryTablesInfo;

    const columns = [];

    tablesUsed.forEach((tableInfo) => {
      const { name: table, schema } = tableInfo;
      const key = `${schema ? schema + '.' : ''}${table}`;

      tableColumns
        .get(key)
        ?.forEach?.((column) => columns.push({ name: column.column_name, table, schema }));
    });

    return {
      schemas: schemasSerialized,
      tablesAvailable,
      tablesUsed,
      columns,
      functions: functionsAvailable,
      snippets: snippetsAvailable,
    };
  }, [connectionsInfo, dialect, currentQueryTablesInfo, id_connection, snippets, tableColumns]);

  React.useEffect(() => {
    loadTableColumns();
  }, [loadTableColumns]);

  React.useEffect(() => {
    loadTableReferences();
  }, [loadTableReferences]);

  return { autocomplete, tableReferences, handleUpdateCurrentQueryInfo };
};
