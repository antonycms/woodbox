import React from 'react';

import { useToast } from '@renderer/contexts/Toast';
import ModalApplyPendingDDL from '@renderer/views/TableInfo/components/Properties/components/ModalApplyPendingDDL';
import { generatePendingTableChangesDdl } from '@renderer/views/TableInfo/components/Properties/tabs/Columns/ddl';
import {
  type IColumnInfo,
  type IColumnReferenceInfo,
  type IColumnRestrictionsInfo,
  type IIndexInfo,
  type ITriggerInfo,
  useStoreContext,
} from '@renderer/contexts/Store';

import TableInfoContext, {
  type ILastFetchDate,
  type ILoadTableInfoFilters,
  type IPendingColumnCreate,
  type IPendingColumnDrop,
  type ITableInfo,
  type ITableInfoLoading,
  type LoadTableInfo,
} from './context';

export type * from './context';

const TableInfoProvider = ({ children }: IThemeProviderProps) => {
  const {
    getTableColumns,
    getTableReferences,
    getTableUsedAsReference,
    getTableRestrictions,
    getTableDefinition,
    getTableIndexes,
    getTableTriggers,
    getColumnTypes,
    runSql,
  } = useStoreContext();
  const { showToast } = useToast();

  const [columns, setColumns] = React.useState<IColumnInfo[]>([]);
  const [pendingColumns, setPendingColumns] = React.useState<IPendingColumnCreate[]>([]);
  const [pendingDroppedColumns, setPendingDroppedColumns] = React.useState<IPendingColumnDrop[]>(
    [],
  );
  const [columnTypes, setColumnTypes] = React.useState<string[]>([]);
  const [references, setReferences] = React.useState<IColumnReferenceInfo[]>([]);
  const [usedAsReference, setUsedAsReference] = React.useState<IColumnReferenceInfo[]>([]);
  const [restrictions, setRestrictions] = React.useState<IColumnRestrictionsInfo[]>([]);
  const [definition, setDefinition] = React.useState<string>('');
  const [indexes, setIndexes] = React.useState<IIndexInfo[]>([]);
  const [triggers, setTriggers] = React.useState<ITriggerInfo[]>([]);
  const [lastFetchDate, setLastFetchDate] = React.useState<ILastFetchDate>({
    columns: new Date(),
    references: new Date(),
    usedAsReference: new Date(),
    restrictions: new Date(),
    definition: new Date(),
    indexes: new Date(),
    triggers: new Date(),
  });
  const [loading, setLoading] = React.useState<ITableInfoLoading>({
    columns: false,
    references: false,
    usedAsReference: false,
    restrictions: false,
    definition: false,
    indexes: false,
    triggers: false,
  });
  const [pendingDdlSql, setPendingDdlSql] = React.useState('');
  const [showPendingDdlModal, setShowPendingDdlModal] = React.useState(false);
  const [applyingPendingDdl, setApplyingPendingDdl] = React.useState(false);
  const pendingApplyInfoRef = React.useRef<{
    idConnection: string;
    filters: ILoadTableInfoFilters;
  }>(null);

  const updateFetchDate = (attribute: keyof ITableInfo) => {
    setLastFetchDate((prevState) => ({
      ...prevState,
      [attribute]: new Date(),
    }));
  };

  const updateLoading = (attribute: keyof ITableInfo, state: boolean) => {
    setLoading((prevState) => ({
      ...prevState,
      [attribute]: state,
    }));
  };

  const loadTableColumns: LoadTableInfo = React.useCallback(async (idConnection, filters) => {
    try {
      updateLoading('columns', true);

      const items = await getTableColumns(idConnection, filters);

      setColumns(items || []);
      updateFetchDate('columns');
    } finally {
      updateLoading('columns', false);
    }
  }, []);

  const loadColumnTypes = React.useCallback(async (idConnection: string) => {
    const items = await getColumnTypes(idConnection);
    const commonTypes = [
      'varchar',
      'text',
      'integer',
      'bigint',
      'serial',
      'bigserial',
      'uuid',
      'boolean',
      'numeric',
      'decimal',
      'date',
      'timestamp',
      'timestamptz',
      'json',
      'jsonb',
    ];
    const loadedTypes = (items || []).map((item) => item.name).filter(Boolean);

    setColumnTypes(
      [...new Set([...commonTypes, ...loadedTypes])].sort((a, b) => a.localeCompare(b)),
    );
  }, []);

  const addPendingColumn = React.useCallback((column: IPendingColumnCreate) => {
    setPendingColumns((prevState) => [
      ...prevState,
      {
        ...column,
        __style: column.__style || {
          backgroundColor: '#3fb95033',
        },
      },
    ]);
  }, []);

  const removePendingColumn = React.useCallback((pendingId: string) => {
    setPendingColumns((prevState) =>
      prevState.filter((column) => column.__pendingId !== pendingId),
    );
  }, []);

  const addPendingDroppedColumns = React.useCallback((columnsToDrop: IColumnInfo[]) => {
    setPendingDroppedColumns((prevState) => {
      const currentColumnNames = new Set(prevState.map((column) => column.column_name));
      const nextColumns = columnsToDrop
        .filter((column) => !currentColumnNames.has(column.column_name))
        .map<IPendingColumnDrop>((column) => ({
          ...column,
          __pendingAction: 'drop',
          __style: {
            backgroundColor: '#ff676733',
            textDecoration: 'line-through',
          },
        }));

      return [...prevState, ...nextColumns];
    });
  }, []);

  const removePendingDroppedColumns = React.useCallback((columnNames: string[]) => {
    const columnNamesSet = new Set(columnNames);

    setPendingDroppedColumns((prevState) =>
      prevState.filter((column) => !columnNamesSet.has(column.column_name)),
    );
  }, []);

  const clearPendingChanges = React.useCallback(() => {
    setPendingColumns([]);
    setPendingDroppedColumns([]);
  }, []);

  const loadTableReferences: LoadTableInfo = React.useCallback(async (idConnection, filters) => {
    try {
      updateLoading('references', true);

      const items = await getTableReferences(idConnection, filters);

      setReferences(items || []);
      updateFetchDate('references');
    } finally {
      updateLoading('references', false);
    }
  }, []);

  const loadTableUsedAsReference: LoadTableInfo = React.useCallback(
    async (idConnection, filters) => {
      try {
        updateLoading('usedAsReference', true);

        const items = await getTableUsedAsReference(idConnection, filters);

        setUsedAsReference(items || []);
        updateFetchDate('usedAsReference');
      } finally {
        updateLoading('usedAsReference', false);
      }
    },
    [],
  );

  const loadTableRestrictions: LoadTableInfo = React.useCallback(async (idConnection, filters) => {
    try {
      updateLoading('restrictions', true);

      const items = await getTableRestrictions(idConnection, filters);

      setRestrictions(items || []);
      updateFetchDate('restrictions');
    } finally {
      updateLoading('restrictions', false);
    }
  }, []);

  const loadTableTriggers: LoadTableInfo = React.useCallback(async (idConnection, filters) => {
    try {
      updateLoading('triggers', true);

      const items = await getTableTriggers(idConnection, filters);

      setTriggers(items || []);
      updateFetchDate('triggers');
    } finally {
      updateLoading('triggers', false);
    }
  }, []);

  const loadTableDefinition: LoadTableInfo = React.useCallback(async (idConnection, filters) => {
    try {
      updateLoading('definition', true);

      const items = await getTableDefinition(idConnection, filters);

      setDefinition(items?.[0]?.definition || '');
      updateFetchDate('definition');
    } finally {
      updateLoading('definition', false);
    }
  }, []);

  const loadTableIndexes: LoadTableInfo = React.useCallback(async (idConnection, filters) => {
    try {
      updateLoading('indexes', true);

      const items = await getTableIndexes(idConnection, filters);

      setIndexes(items || []);
      updateFetchDate('indexes');
    } finally {
      updateLoading('indexes', false);
    }
  }, []);

  const openPendingChangesSqlModal = React.useCallback(
    (idConnection: string, filters: ILoadTableInfoFilters) => {
      const sql = generatePendingTableChangesDdl(filters.schema, filters.table, {
        columns: pendingColumns,
        droppedColumns: pendingDroppedColumns,
        restrictions,
        references,
      });

      if (!sql.trim()) return;

      pendingApplyInfoRef.current = { idConnection, filters };
      setPendingDdlSql(sql);
      setShowPendingDdlModal(true);
    },
    [pendingColumns, pendingDroppedColumns, references, restrictions, showToast],
  );

  const applyPendingChangesSql = React.useCallback(
    async (sql: string) => {
      const applyInfo = pendingApplyInfoRef.current;
      if (!applyInfo || !sql.trim()) return;

      try {
        setApplyingPendingDdl(true);

        await runSql(applyInfo.idConnection, sql);
        clearPendingChanges();
        setShowPendingDdlModal(false);
        showToast({ type: 'success', title: 'Alterações aplicadas com sucesso!' });

        await Promise.all([
          loadTableColumns(applyInfo.idConnection, applyInfo.filters),
          loadTableRestrictions(applyInfo.idConnection, applyInfo.filters),
          loadTableReferences(applyInfo.idConnection, applyInfo.filters),
          loadTableIndexes(applyInfo.idConnection, applyInfo.filters),
        ]);
      } catch (error: any) {
        showToast({
          type: 'error',
          title: 'Erro ao aplicar alterações.',
          description: error?.message,
          delay: 8000,
        });
      } finally {
        setApplyingPendingDdl(false);
      }
    },
    [
      clearPendingChanges,
      loadTableColumns,
      loadTableIndexes,
      loadTableReferences,
      loadTableRestrictions,
      runSql,
      showToast,
    ],
  );

  return (
    <TableInfoContext.Provider
      value={{
        columns,
        pendingColumns,
        pendingDroppedColumns,
        columnTypes,
        references,
        usedAsReference,
        restrictions,
        definition,
        indexes,
        triggers,

        addPendingColumn,
        removePendingColumn,
        addPendingDroppedColumns,
        removePendingDroppedColumns,
        clearPendingChanges,
        loadColumnTypes,
        openPendingChangesSqlModal,

        loadTableColumns,
        loadTableReferences,
        loadTableUsedAsReference,
        loadTableRestrictions,
        loadTableDefinition,
        loadTableIndexes,
        loadTableTriggers,

        lastFetchDate,
        loading,
      }}
    >
      {children}

      <ModalApplyPendingDDL
        show={showPendingDdlModal}
        sql={pendingDdlSql}
        applying={applyingPendingDdl}
        onClose={() => setShowPendingDdlModal(false)}
        onApply={applyPendingChangesSql}
      />
    </TableInfoContext.Provider>
  );
};

export const useTableInfoContext = () => {
  return React.useContext(TableInfoContext);
};

export default TableInfoProvider;

interface IThemeProviderProps {
  children?: React.ReactNode;
}
