import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { useI18nStore } from '@renderer/stores/I18n';
import { getErrorMessage } from '@shared/utils/error';
import { useToastStore } from '@renderer/stores/Toast';
import {
  generateCreateTableDdl,
  generatePendingTableChangesDdl,
} from '@renderer/database/ddl';
import { getRendererDialect } from '@renderer/database/dialects';
import type {
  IColumnInfo,
  IColumnReferenceInfo,
  IColumnRestrictionsInfo,
  IIndexInfo,
} from '@shared/types/database';
import { useDatabaseStore } from '@renderer/stores/Database';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import type {
  IPendingColumnChange,
  IPendingColumnCreate,
  IPendingColumnDrop,
  IPendingIndexCreate,
  IPendingIndexDrop,
  IPendingReferenceCreate,
  IPendingReferenceDrop,
  IPendingRestrictionCreate,
  IPendingRestrictionDrop,
} from '@renderer/database/ddl/types';
import {
  type ILoadTableInfoFilters,
  type IOpenPendingChangesSqlModalOptions,
  type ITableInfo,
  type ITableInfoStore,
  type LoadTableInfo,
} from './types';

const COLUMN_COMPARE_ATTRIBUTES: Array<keyof IColumnInfo> = [
  'column_name',
  'data_type',
  'character_maximum_length',
  'numeric_precision',
  'numeric_scale',
  'datetime_precision',
  'is_nullable',
  'column_default',
  'is_auto_increment',
  'description',
];

const normalizeColumnCompareValue = (value: unknown) => {
  if (value === '') return undefined;

  return value;
};

const hasColumnChanges = (originalColumn: IColumnInfo, changedColumn: IColumnInfo) =>
  COLUMN_COMPARE_ATTRIBUTES.some(
    (attribute) =>
      normalizeColumnCompareValue(originalColumn[attribute]) !==
      normalizeColumnCompareValue(changedColumn[attribute]),
  );

export const createTableInfoStore = () =>
  createStore<ITableInfoStore>()((set, get) => {
    let pendingApplyInfo = null as {
      idConnection: string;
      filters: ILoadTableInfoFilters;
      options?: IOpenPendingChangesSqlModalOptions;
    } | null;

    const updateFetchDate = (attribute: keyof ITableInfo) => {
      set(({ lastFetchDate: prevState }) => ({
        lastFetchDate: {
          ...prevState,
          [attribute]: new Date(),
        },
      }));
    };

    const updateLoading = (attribute: keyof ITableInfo, state: boolean) => {
      set(({ loading: prevState }) => ({
        loading: {
          ...prevState,
          [attribute]: state,
        },
      }));
    };

    const getConnectionDialect = (idConnection: string) => {
      const connections = useWorkspaceStore.getState().connections;
      return getRendererDialect(
        connections.find((connection) => connection.id === idConnection)?.dialect,
      );
    };

    const loadTableColumns: LoadTableInfo = async (idConnection, filters) => {
      const getTableColumns = useDatabaseStore.getState().getTableColumns;
      try {
        updateLoading('columns', true);

        const items = await getTableColumns(idConnection, filters);

        set({ columns: items || [] });
        updateFetchDate('columns');
      } finally {
        updateLoading('columns', false);
      }
    };

    const loadColumnTypes = async (idConnection: string) => {
      const getColumnTypes = useDatabaseStore.getState().getColumnTypes;
      const items = await getColumnTypes(idConnection);
      const commonTypes = getConnectionDialect(idConnection).commonColumnTypes;
      const loadedTypes = (items || []).map((item) => item.name).filter(Boolean);

      set({
        columnTypes: [...new Set([...commonTypes, ...loadedTypes])].sort((a, b) =>
          a.localeCompare(b),
        ),
      });
    };

    const addPendingColumn = (column: IPendingColumnCreate) => {
      set(({ pendingColumns: prevState }) => ({ pendingColumns: [...prevState, column] }));
    };

    const updatePendingColumn = (pendingId: string, columnChanges: Partial<IColumnInfo>) => {
      set((state) => {
        const currentColumn = state.pendingColumns.find(
          (column) => column.__pendingId === pendingId,
        );
        if (!currentColumn) return state;
        const oldName = currentColumn.column_name;
        const newName = columnChanges.column_name;
        const renamed = !!newName && newName !== oldName;
        const rename = (name: string) => (name === oldName ? newName : name);
        return {
          pendingColumns: state.pendingColumns.map((column) =>
            column.__pendingId === pendingId ? { ...column, ...columnChanges } : column,
          ),
          pendingIndexes: renamed
            ? state.pendingIndexes.map((index) => ({
                ...index,
                column_names: index.column_names?.map(rename),
              }))
            : state.pendingIndexes,
          pendingRestrictions: renamed
            ? state.pendingRestrictions.map((restriction) => ({
                ...restriction,
                column_names: restriction.column_names?.map(rename),
              }))
            : state.pendingRestrictions,
          pendingReferences: renamed
            ? state.pendingReferences.map((reference) =>
                reference.column_name === oldName
                  ? { ...reference, column_name: newName }
                  : reference,
              )
            : state.pendingReferences,
        };
      });
    };

    const removePendingColumn = (pendingId: string) => {
      set((state) => {
        const removedColumn = state.pendingColumns.find(
          (column) => column.__pendingId === pendingId,
        );
        if (!removedColumn) return state;
        const name = removedColumn.column_name;
        return {
          pendingColumns: state.pendingColumns.filter((column) => column.__pendingId !== pendingId),
          pendingIndexes: state.pendingIndexes.filter(
            (index) => !index.column_names?.includes(name),
          ),
          pendingRestrictions: state.pendingRestrictions.filter(
            (restriction) => !restriction.column_names?.includes(name),
          ),
          pendingReferences: state.pendingReferences.filter(
            (reference) => reference.column_name !== name,
          ),
        };
      });
    };

    const addPendingChangedColumn = (column: IColumnInfo, columnChanges: Partial<IColumnInfo>) => {
      const pendingColumn = column as IPendingColumnChange;
      const originalColumn = pendingColumn.__originalColumn || column;
      const currentColumn = pendingColumn.__originalColumn ? pendingColumn : originalColumn;
      const changedColumn = { ...currentColumn, ...columnChanges, __originalColumn: undefined };

      delete (changedColumn as Partial<IPendingColumnChange>).__originalColumn;

      set(({ pendingChangedColumns: prevState }) => {
        const nextColumn: IPendingColumnChange = {
          ...originalColumn,
          ...changedColumn,
          __originalColumn: originalColumn,
        };

        if (!hasColumnChanges(originalColumn, nextColumn)) {
          return {
            pendingChangedColumns: prevState.filter(
              (item) => item.__originalColumn.column_name !== originalColumn.column_name,
            ),
          };
        }

        const currentColumnIndex = prevState.findIndex(
          (item) => item.__originalColumn.column_name === originalColumn.column_name,
        );

        if (currentColumnIndex === -1) return { pendingChangedColumns: [...prevState, nextColumn] };

        const nextState = [...prevState];
        nextState[currentColumnIndex] = nextColumn;

        return { pendingChangedColumns: nextState };
      });
    };

    const removePendingChangedColumns = (columnNames: string[]) => {
      const columnNamesSet = new Set(columnNames);

      set(({ pendingChangedColumns: prevState }) => ({
        pendingChangedColumns: prevState.filter(
          (column) =>
            !columnNamesSet.has(column.column_name) &&
            !columnNamesSet.has(column.__originalColumn.column_name),
        ),
      }));
    };

    const addPendingDroppedColumns = (columnsToDrop: IColumnInfo[]) => {
      const droppedColumnNames = columnsToDrop.map((column) => column.column_name);

      removePendingChangedColumns(droppedColumnNames);

      set(({ pendingDroppedColumns: prevState }) => {
        const currentColumnNames = new Set(prevState.map((column) => column.column_name));
        const nextColumns = columnsToDrop
          .filter((column) => !currentColumnNames.has(column.column_name))
          .map<IPendingColumnDrop>((column) => ({ ...column }));

        return { pendingDroppedColumns: [...prevState, ...nextColumns] };
      });
    };

    const removePendingDroppedColumns = (columnNames: string[]) => {
      const columnNamesSet = new Set(columnNames);

      set(({ pendingDroppedColumns: prevState }) => ({
        pendingDroppedColumns: prevState.filter(
          (column) => !columnNamesSet.has(column.column_name),
        ),
      }));
    };

    const addPendingIndex = (index: IPendingIndexCreate) => {
      set(({ pendingIndexes: prevState }) => ({ pendingIndexes: [...prevState, index] }));
    };

    const removePendingIndex = (pendingId: string) => {
      set(({ pendingIndexes: prevState }) => ({
        pendingIndexes: prevState.filter((index) => index.__pendingId !== pendingId),
      }));
    };

    const addPendingDroppedIndexes = (indexesToDrop: IIndexInfo[]) => {
      set(({ pendingDroppedIndexes: prevState }) => {
        const currentIndexNames = new Set(prevState.map((index) => index.index_name));
        const nextIndexes = indexesToDrop
          .filter((index) => !currentIndexNames.has(index.index_name))
          .map<IPendingIndexDrop>((index) => ({ ...index }));

        return { pendingDroppedIndexes: [...prevState, ...nextIndexes] };
      });
    };

    const removePendingDroppedIndexes = (indexNames: string[]) => {
      const indexNamesSet = new Set(indexNames);

      set(({ pendingDroppedIndexes: prevState }) => ({
        pendingDroppedIndexes: prevState.filter((index) => !indexNamesSet.has(index.index_name)),
      }));
    };

    const addPendingRestriction = (restriction: IPendingRestrictionCreate) => {
      set(({ pendingRestrictions: prevState }) => ({
        pendingRestrictions: [...prevState, restriction],
      }));
    };

    const removePendingRestriction = (pendingId: string) => {
      set(({ pendingRestrictions: prevState }) => ({
        pendingRestrictions: prevState.filter(
          (restriction) => restriction.__pendingId !== pendingId,
        ),
      }));
    };

    const addPendingDroppedRestrictions = (restrictionsToDrop: IColumnRestrictionsInfo[]) => {
      set(({ pendingDroppedRestrictions: prevState }) => {
        const currentConstraintNames = new Set(
          prevState.map((restriction) => restriction.constraint_name),
        );
        const nextRestrictions = restrictionsToDrop
          .filter((restriction) => !currentConstraintNames.has(restriction.constraint_name))
          .map<IPendingRestrictionDrop>((restriction) => ({ ...restriction }));

        return { pendingDroppedRestrictions: [...prevState, ...nextRestrictions] };
      });
    };

    const removePendingDroppedRestrictions = (constraintNames: string[]) => {
      const constraintNamesSet = new Set(constraintNames);

      set(({ pendingDroppedRestrictions: prevState }) => ({
        pendingDroppedRestrictions: prevState.filter(
          (restriction) => !constraintNamesSet.has(restriction.constraint_name),
        ),
      }));
    };

    const addPendingReference = (reference: IPendingReferenceCreate) => {
      set(({ pendingReferences: prevState }) => ({ pendingReferences: [...prevState, reference] }));
    };

    const removePendingReference = (pendingId: string) => {
      set(({ pendingReferences: prevState }) => ({
        pendingReferences: prevState.filter((reference) => reference.__pendingId !== pendingId),
      }));
    };

    const addPendingDroppedReferences = (referencesToDrop: IColumnReferenceInfo[]) => {
      set(({ pendingDroppedReferences: prevState }) => {
        const currentConstraintNames = new Set(
          prevState.map((reference) => reference.constraint_name),
        );
        const nextReferencesByConstraint = new Map<string, IPendingReferenceDrop>();

        referencesToDrop.forEach((reference) => {
          if (currentConstraintNames.has(reference.constraint_name)) return;
          if (nextReferencesByConstraint.has(reference.constraint_name)) return;

          nextReferencesByConstraint.set(reference.constraint_name, { ...reference });
        });

        return { pendingDroppedReferences: [...prevState, ...nextReferencesByConstraint.values()] };
      });
    };

    const removePendingDroppedReferences = (constraintNames: string[]) => {
      const constraintNamesSet = new Set(constraintNames);

      set(({ pendingDroppedReferences: prevState }) => ({
        pendingDroppedReferences: prevState.filter(
          (reference) => !constraintNamesSet.has(reference.constraint_name),
        ),
      }));
    };

    const clearPendingChanges = () => {
      set({
        pendingColumns: [],
        pendingDroppedColumns: [],
        pendingChangedColumns: [],
        pendingIndexes: [],
        pendingDroppedIndexes: [],
        pendingRestrictions: [],
        pendingDroppedRestrictions: [],
        pendingReferences: [],
        pendingDroppedReferences: [],
      });
    };

    const loadTableReferences: LoadTableInfo = async (idConnection, filters) => {
      const getTableReferences = useDatabaseStore.getState().getTableReferences;
      try {
        updateLoading('references', true);

        const items = await getTableReferences(idConnection, filters);

        set({ references: items || [] });
        updateFetchDate('references');
      } finally {
        updateLoading('references', false);
      }
    };

    const loadTableUsedAsReference: LoadTableInfo = async (idConnection, filters) => {
      const getTableUsedAsReference = useDatabaseStore.getState().getTableUsedAsReference;
      try {
        updateLoading('usedAsReference', true);

        const items = await getTableUsedAsReference(idConnection, filters);

        set({ usedAsReference: items || [] });
        updateFetchDate('usedAsReference');
      } finally {
        updateLoading('usedAsReference', false);
      }
    };

    const loadTableRestrictions: LoadTableInfo = async (idConnection, filters) => {
      const getTableRestrictions = useDatabaseStore.getState().getTableRestrictions;
      try {
        updateLoading('restrictions', true);

        const items = await getTableRestrictions(idConnection, filters);

        set({ restrictions: items || [] });
        updateFetchDate('restrictions');
      } finally {
        updateLoading('restrictions', false);
      }
    };

    const loadTableTriggers: LoadTableInfo = async (idConnection, filters) => {
      const getTableTriggers = useDatabaseStore.getState().getTableTriggers;
      try {
        updateLoading('triggers', true);

        const items = await getTableTriggers(idConnection, filters);

        set({ triggers: items || [] });
        updateFetchDate('triggers');
      } finally {
        updateLoading('triggers', false);
      }
    };

    const loadTableDefinition: LoadTableInfo = async (idConnection, filters) => {
      const getTableDefinition = useDatabaseStore.getState().getTableDefinition;
      try {
        updateLoading('definition', true);

        const items = await getTableDefinition(idConnection, filters);

        set({ definition: items?.[0]?.definition || '' });
        updateFetchDate('definition');
      } finally {
        updateLoading('definition', false);
      }
    };

    const loadTableIndexes: LoadTableInfo = async (idConnection, filters) => {
      const getTableIndexes = useDatabaseStore.getState().getTableIndexes;
      try {
        updateLoading('indexes', true);

        const items = await getTableIndexes(idConnection, filters);

        set({ indexes: items || [] });
        updateFetchDate('indexes');
      } finally {
        updateLoading('indexes', false);
      }
    };

    const openPendingChangesSqlModal = (
      idConnection: string,
      filters: ILoadTableInfoFilters,
      options?: IOpenPendingChangesSqlModalOptions,
    ) => {
      const {
        pendingColumns,
        pendingIndexes,
        pendingRestrictions,
        pendingReferences,
        pendingDroppedColumns,
        pendingChangedColumns,
        pendingDroppedIndexes,
        pendingDroppedRestrictions,
        pendingDroppedReferences,
        restrictions,
        references,
        columns,
      } = get();
      const showToast = useToastStore.getState().showToast;
      const t = useI18nStore.getState().t;
      if (options?.mode === 'create') {
        if (!filters.table?.trim()) {
          showToast({ type: 'warn', title: t('toast.tableNameRequired') });
          return;
        }

        if (!pendingColumns.length) {
          showToast({ type: 'warn', title: t('toast.addAtLeastOneColumn') });
          return;
        }
      }

      const dialect = getConnectionDialect(idConnection);

      const sql =
        options?.mode === 'create'
          ? generateCreateTableDdl(dialect, filters.schema, filters.table, {
              columns: pendingColumns,
              indexes: pendingIndexes,
              restrictions: pendingRestrictions,
              references: pendingReferences,
              tableComment: options.tableComment,
            })
          : generatePendingTableChangesDdl(dialect, filters.schema, filters.table, {
              columns: pendingColumns,
              droppedColumns: pendingDroppedColumns,
              changedColumns: pendingChangedColumns,
              indexes: pendingIndexes,
              droppedIndexes: pendingDroppedIndexes,
              restrictions: pendingRestrictions,
              droppedRestrictions: pendingDroppedRestrictions,
              references: pendingReferences,
              droppedReferences: pendingDroppedReferences,
              existingRestrictions: restrictions,
              existingReferences: references,
              existingColumns: columns,
            });

      if (!sql.trim()) return;

      pendingApplyInfo = { idConnection, filters, options };
      set({ pendingConnectionId: idConnection });
      set({ pendingDdlSql: sql });
      set({ showPendingDdlModal: true });
    };

    const applyPendingChangesSql = async (sql: string) => {
      const runSql = useDatabaseStore.getState().runSql;
      const showToast = useToastStore.getState().showToast;
      const t = useI18nStore.getState().t;
      const loadConnectionInfo = useWorkspaceStore.getState().loadConnectionInfo;
      const applyInfo = pendingApplyInfo;
      if (!applyInfo || !sql.trim()) return;

      try {
        set({ applyingPendingDdl: true });

        await runSql(applyInfo.idConnection, sql);
        clearPendingChanges();
        set({ showPendingDdlModal: false });
        showToast({ type: 'success', title: t('toast.applyChangesSuccess') });

        if (applyInfo.options?.mode === 'create') {
          applyInfo.options.onApplied?.(applyInfo.filters.table);
        }

        await Promise.all([
          loadConnectionInfo(applyInfo.idConnection),
          loadTableColumns(applyInfo.idConnection, applyInfo.filters),
          loadTableRestrictions(applyInfo.idConnection, applyInfo.filters),
          loadTableReferences(applyInfo.idConnection, applyInfo.filters),
          loadTableIndexes(applyInfo.idConnection, applyInfo.filters),
        ]);
      } catch (error) {
        showToast({
          type: 'error',
          title: t('toast.applyChangesError'),
          description: getErrorMessage(error),
          delay: 8000,
        });
      } finally {
        set({ applyingPendingDdl: false });
      }
    };

    return {
      columns: [],
      pendingColumns: [],
      pendingDroppedColumns: [],
      pendingChangedColumns: [],
      pendingIndexes: [],
      pendingDroppedIndexes: [],
      pendingRestrictions: [],
      pendingDroppedRestrictions: [],
      pendingReferences: [],
      pendingDroppedReferences: [],
      columnTypes: [],
      references: [],
      usedAsReference: [],
      restrictions: [],
      definition: '',
      indexes: [],
      triggers: [],
      lastFetchDate: {
        columns: new Date(),
        references: new Date(),
        usedAsReference: new Date(),
        restrictions: new Date(),
        definition: new Date(),
        indexes: new Date(),
        triggers: new Date(),
      },
      loading: {
        columns: false,
        references: false,
        usedAsReference: false,
        restrictions: false,
        definition: false,
        indexes: false,
        triggers: false,
      },
      pendingDdlSql: '',
      showPendingDdlModal: false,
      applyingPendingDdl: false,
      loadTableColumns,
      loadColumnTypes,
      addPendingColumn,
      updatePendingColumn,
      removePendingColumn,
      addPendingChangedColumn,
      removePendingChangedColumns,
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
      loadTableReferences,
      loadTableUsedAsReference,
      loadTableRestrictions,
      loadTableTriggers,
      loadTableDefinition,
      loadTableIndexes,
      openPendingChangesSqlModal,
      applyPendingChangesSql,
      closePendingDdlModal: () => set({ showPendingDdlModal: false }),
    };
  });

export type TableInfoStoreApi = ReturnType<typeof createTableInfoStore>;

export const useTableInfoStore = <T>(
  store: TableInfoStoreApi,
  selector: (state: ITableInfoStore) => T,
) => useStore(store, selector);
