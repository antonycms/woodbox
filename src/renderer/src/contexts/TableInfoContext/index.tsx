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
  type IPendingIndexCreate,
  type IPendingIndexDrop,
  type IPendingReferenceCreate,
  type IPendingReferenceDrop,
  type IPendingRestrictionCreate,
  type IPendingRestrictionDrop,
  type ITableInfo,
  type ITableInfoLoading,
  type LoadTableInfo,
} from './context';

export type * from './context';

const CREATE_STYLE = { backgroundColor: '#3fb95033' };
const DROP_STYLE = { backgroundColor: '#ff676733', textDecoration: 'line-through' };

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
  const [pendingIndexes, setPendingIndexes] = React.useState<IPendingIndexCreate[]>([]);
  const [pendingDroppedIndexes, setPendingDroppedIndexes] = React.useState<IPendingIndexDrop[]>([]);
  const [pendingRestrictions, setPendingRestrictions] = React.useState<IPendingRestrictionCreate[]>(
    [],
  );
  const [pendingDroppedRestrictions, setPendingDroppedRestrictions] = React.useState<
    IPendingRestrictionDrop[]
  >([]);
  const [pendingReferences, setPendingReferences] = React.useState<IPendingReferenceCreate[]>([]);
  const [pendingDroppedReferences, setPendingDroppedReferences] = React.useState<
    IPendingReferenceDrop[]
  >([]);
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
        __style: column.__style || CREATE_STYLE,
      },
    ]);
  }, []);

  const removePendingColumn = React.useCallback((pendingId: string) => {
    setPendingColumns((prevState) => {
      const removedColumn = prevState.find((column) => column.__pendingId === pendingId);
      if (!removedColumn) return prevState;

      const removedColumnName = removedColumn.column_name;

      setPendingIndexes((indexes) =>
        indexes.filter((index) => !index.column_names?.includes(removedColumnName)),
      );
      setPendingRestrictions((restrictions) =>
        restrictions.filter(
          (restriction) => !restriction.column_names?.includes(removedColumnName),
        ),
      );
      setPendingReferences((references) =>
        references.filter((reference) => reference.column_name !== removedColumnName),
      );

      return prevState.filter((column) => column.__pendingId !== pendingId);
    });
  }, []);

  const addPendingDroppedColumns = React.useCallback((columnsToDrop: IColumnInfo[]) => {
    setPendingDroppedColumns((prevState) => {
      const currentColumnNames = new Set(prevState.map((column) => column.column_name));
      const nextColumns = columnsToDrop
        .filter((column) => !currentColumnNames.has(column.column_name))
        .map<IPendingColumnDrop>((column) => ({
          ...column,
          __pendingAction: 'drop',
          __style: DROP_STYLE,
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

  const addPendingIndex = React.useCallback((index: IPendingIndexCreate) => {
    setPendingIndexes((prevState) => [
      ...prevState,
      {
        ...index,
        __style: index.__style || CREATE_STYLE,
      },
    ]);
  }, []);

  const removePendingIndex = React.useCallback((pendingId: string) => {
    setPendingIndexes((prevState) => prevState.filter((index) => index.__pendingId !== pendingId));
  }, []);

  const addPendingDroppedIndexes = React.useCallback((indexesToDrop: IIndexInfo[]) => {
    setPendingDroppedIndexes((prevState) => {
      const currentIndexNames = new Set(prevState.map((index) => index.index_name));
      const nextIndexes = indexesToDrop
        .filter((index) => !currentIndexNames.has(index.index_name))
        .map<IPendingIndexDrop>((index) => ({
          ...index,
          __pendingAction: 'drop',
          __style: DROP_STYLE,
        }));

      return [...prevState, ...nextIndexes];
    });
  }, []);

  const removePendingDroppedIndexes = React.useCallback((indexNames: string[]) => {
    const indexNamesSet = new Set(indexNames);

    setPendingDroppedIndexes((prevState) =>
      prevState.filter((index) => !indexNamesSet.has(index.index_name)),
    );
  }, []);

  const addPendingRestriction = React.useCallback((restriction: IPendingRestrictionCreate) => {
    setPendingRestrictions((prevState) => [
      ...prevState,
      {
        ...restriction,
        __style: restriction.__style || CREATE_STYLE,
      },
    ]);
  }, []);

  const removePendingRestriction = React.useCallback((pendingId: string) => {
    setPendingRestrictions((prevState) =>
      prevState.filter((restriction) => restriction.__pendingId !== pendingId),
    );
  }, []);

  const addPendingDroppedRestrictions = React.useCallback(
    (restrictionsToDrop: IColumnRestrictionsInfo[]) => {
      setPendingDroppedRestrictions((prevState) => {
        const currentConstraintNames = new Set(
          prevState.map((restriction) => restriction.constraint_name),
        );
        const nextRestrictions = restrictionsToDrop
          .filter((restriction) => !currentConstraintNames.has(restriction.constraint_name))
          .map<IPendingRestrictionDrop>((restriction) => ({
            ...restriction,
            __pendingAction: 'drop',
            __style: DROP_STYLE,
          }));

        return [...prevState, ...nextRestrictions];
      });
    },
    [],
  );

  const removePendingDroppedRestrictions = React.useCallback((constraintNames: string[]) => {
    const constraintNamesSet = new Set(constraintNames);

    setPendingDroppedRestrictions((prevState) =>
      prevState.filter((restriction) => !constraintNamesSet.has(restriction.constraint_name)),
    );
  }, []);

  const addPendingReference = React.useCallback((reference: IPendingReferenceCreate) => {
    setPendingReferences((prevState) => [
      ...prevState,
      {
        ...reference,
        __style: reference.__style || CREATE_STYLE,
      },
    ]);
  }, []);

  const removePendingReference = React.useCallback((pendingId: string) => {
    setPendingReferences((prevState) =>
      prevState.filter((reference) => reference.__pendingId !== pendingId),
    );
  }, []);

  const addPendingDroppedReferences = React.useCallback(
    (referencesToDrop: IColumnReferenceInfo[]) => {
      setPendingDroppedReferences((prevState) => {
        const currentConstraintNames = new Set(
          prevState.map((reference) => reference.constraint_name),
        );
        const nextReferencesByConstraint = new Map<string, IPendingReferenceDrop>();

        referencesToDrop.forEach((reference) => {
          if (currentConstraintNames.has(reference.constraint_name)) return;
          if (nextReferencesByConstraint.has(reference.constraint_name)) return;

          nextReferencesByConstraint.set(reference.constraint_name, {
            ...reference,
            __pendingAction: 'drop',
            __style: DROP_STYLE,
          });
        });

        return [...prevState, ...nextReferencesByConstraint.values()];
      });
    },
    [],
  );

  const removePendingDroppedReferences = React.useCallback((constraintNames: string[]) => {
    const constraintNamesSet = new Set(constraintNames);

    setPendingDroppedReferences((prevState) =>
      prevState.filter((reference) => !constraintNamesSet.has(reference.constraint_name)),
    );
  }, []);

  const clearPendingChanges = React.useCallback(() => {
    setPendingColumns([]);
    setPendingDroppedColumns([]);
    setPendingIndexes([]);
    setPendingDroppedIndexes([]);
    setPendingRestrictions([]);
    setPendingDroppedRestrictions([]);
    setPendingReferences([]);
    setPendingDroppedReferences([]);
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
        indexes: pendingIndexes,
        droppedIndexes: pendingDroppedIndexes,
        restrictions: pendingRestrictions,
        droppedRestrictions: pendingDroppedRestrictions,
        references: pendingReferences,
        droppedReferences: pendingDroppedReferences,
        existingRestrictions: restrictions,
        existingReferences: references,
      });

      if (!sql.trim()) return;

      pendingApplyInfoRef.current = { idConnection, filters };
      setPendingDdlSql(sql);
      setShowPendingDdlModal(true);
    },
    [
      pendingColumns,
      pendingDroppedColumns,
      pendingDroppedIndexes,
      pendingDroppedReferences,
      pendingDroppedRestrictions,
      pendingIndexes,
      pendingReferences,
      pendingRestrictions,
      references,
      restrictions,
    ],
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
        pendingIndexes,
        pendingDroppedIndexes,
        pendingRestrictions,
        pendingDroppedRestrictions,
        pendingReferences,
        pendingDroppedReferences,
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
        addPendingIndex,
        removePendingIndex,
        addPendingDroppedIndexes,
        removePendingDroppedIndexes,
        addPendingRestriction,
        removePendingRestriction,
        addPendingDroppedRestrictions,
        removePendingDroppedRestrictions,
        addPendingReference,
        removePendingReference,
        addPendingDroppedReferences,
        removePendingDroppedReferences,
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
