import { selectConnectionPresentations } from '@renderer/stores/Workspace/selectors';
import { getColumnEditChanges, hasColumnChanges } from './columnGridEdits';
import type { ColumnGridInput, ColumnGridDiagnostic } from './types';
import type { TranslationKey } from '@renderer/stores/I18n/translations';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';

import { useI18nStore } from '@renderer/stores/I18n';
import { getErrorMessage } from '@shared/utils/error';
import { useToastStore } from '@renderer/stores/Toast';
import { requestStructureDdl, toStructureColumn, toStructureIndex, toStructureReference, toStructureRestriction } from './ddl';
import type { PrepareStructureDdlRequest } from '@shared/types/databaseDdl';
import type {
  IColumnInfo,
  IColumnReferenceInfo,
  IColumnRestrictionsInfo,
  IIndexInfo,
} from '@shared/types/database';
import { useDatabaseStore } from '@renderer/stores/Database';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import type {
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
  type ITableContextState,
  type ITableInfo,
  type ITablePropertiesState,
  type ITableInfoStore,
  type LoadTableInfo,
} from './types';

const normalizeOptionalString = (value?: string) => value?.trim() || '';

export const createTableInfoStore = () =>
  createStore<ITableInfoStore>()((set, get) => {
    let pendingApplyInfo = null as {
      idConnection: string;
      filters: ILoadTableInfoFilters;
      options?: IOpenPendingChangesSqlModalOptions;
      nextTable: string;
    } | null;

    // Per-instance load state: an empty successful result is still loaded.
    const tableLoads = new Map<string, Promise<void>>();
    const loadTablePart = (
      part: keyof ITableInfo, idConnection: string, filters: ILoadTableInfoFilters,
      onlyIfMissing: boolean, load: () => Promise<void>,
    ) => {
      const key = JSON.stringify([part, idConnection, filters.schema, filters.table]);
      const previous = tableLoads.get(key);
      if (onlyIfMissing && previous) return previous;
      const request = Promise.resolve().then(load).catch((error) => {
        if (tableLoads.get(key) === request) tableLoads.delete(key);
        throw error;
      });
      tableLoads.set(key, request);
      return request;
    };

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

    const getConnectionDialect = (idConnection: string) =>
      selectConnectionPresentations(useWorkspaceStore.getState()).get(idConnection)?.dialect || 'postgres';

    const loadTableColumns: LoadTableInfo = (idConnection, filters, onlyIfMissing = false) =>
      loadTablePart('columns', idConnection, filters, onlyIfMissing, async () => {
        try {
          updateLoading('columns', true);
          const data = await useDatabaseStore.getState().getColumnGridData(idConnection, filters);
          set({ columns: data.rows });
          updateFetchDate('columns');
        } finally {
          updateLoading('columns', false);
        }
      });

    const loadColumnTypes = async (idConnection: string) => {
      const getColumnTypes = useDatabaseStore.getState().getColumnTypes;
      const catalog = useWorkspaceStore.getState().dialectCatalog;
      const knownTypes = catalog.status === 'ready'
        ? catalog.items.find((item) => item.id === getConnectionDialect(idConnection))?.columnTypeSuggestions
        : undefined;
      const result = knownTypes || await getColumnTypes(idConnection);
      const commonTypes = result.commonTypes;
      const loadedTypes = (result.types || []).map((item) => item.name).filter(Boolean);

      set({
        columnTypeEligibility: result.autoIncrementTypes,
        columnTypes: [...new Set([...commonTypes, ...loadedTypes])].sort((a, b) =>
          a.localeCompare(b),
        ),
      });
    };

    const applyColumnEdits = (inputs: ColumnGridInput[]): ColumnGridDiagnostic[] => {
      const rejectedEdits: ColumnGridDiagnostic[] = [];
      set((state) => {
        const loaded = new Map(state.columns.map((column) => [column.column_name, column]));
        const changed = new Map(state.pendingChangedColumns.map((column) => [column.__originalColumn.column_name, column]));
        const created = new Map(state.pendingColumns.map((column) => [column.__pendingId, column]));
        const eligibility = new Map(Object.entries(state.columnTypeEligibility));
        // Preserve name validation against the names at the start of the batch.
        const existingNames = new Map(state.columns.map((column) => [
          column.column_name, (changed.get(column.column_name) || column).column_name.toLowerCase(),
        ]));
        const newNames = new Map(state.pendingColumns.map((column) => [column.__pendingId, column.column_name.toLowerCase()]));
        const nameCounts = new Map<string, number>();
        for (const name of [...existingNames.values(), ...newNames.values()]) {
          nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
        }

        let hasEdits = false;
        const renames: { from: string; to: string }[] = [];
        for (const { identity, edit } of inputs) {
          if ('originalName' in identity && !loaded.has(identity.originalName)) continue;
          const current = 'pendingId' in identity
            ? created.get(identity.pendingId)
            : changed.get(identity.originalName) || loaded.get(identity.originalName);
          if (!current) continue;
          const original = 'originalName' in identity
            ? changed.get(identity.originalName)?.__originalColumn || loaded.get(identity.originalName)
            : current;
          hasEdits = true;
          const ownName = 'pendingId' in identity ? newNames.get(identity.pendingId) : existingNames.get(identity.originalName);
          const isNameTaken = (name: string) => {
            const normalized = name.toLowerCase();
            return (nameCounts.get(normalized) || 0) > Number(ownName === normalized);
          };
          for (const column of [original, current]) {
            if (typeof column.auto_increment_eligible === 'boolean') {
              eligibility.set(column.data_type, column.auto_increment_eligible);
            }
          }
          const changes = getColumnEditChanges(current, original, edit, eligibility, isNameTaken);
          if (typeof changes === 'string') {
            rejectedEdits.push(changes);
            continue;
          }

          const updated = { ...current, ...changes };
          if ('pendingId' in identity) {
            created.set(identity.pendingId, { ...updated, __pendingId: identity.pendingId });
            if (updated.column_name !== current.column_name) {
              renames.push({ from: current.column_name, to: updated.column_name });
            }
          } else if (hasColumnChanges(original, updated)) {
            changed.set(identity.originalName, { ...updated, __originalColumn: original });
          } else {
            // After a complete revert, the next cell starts from loaded metadata.
            changed.delete(identity.originalName);
          }
        }

        if (!hasEdits) return state;

        // Compose ordered renames once instead of scanning dependencies per cell.
        const renamedColumns = new Map<string, string>();
        for (let index = renames.length - 1; index >= 0; index--) {
          const { from, to } = renames[index];
          renamedColumns.set(from, renamedColumns.get(to) ?? to);
        }
        const rename = (name: string) => renamedColumns.get(name) ?? name;
        return {
          pendingColumns: [...created.values()],
          pendingChangedColumns: [...changed.values()],
          ...(renamedColumns.size ? {
            pendingIndexes: state.pendingIndexes.map((index) => ({ ...index, column_names: index.column_names?.map(rename) })),
            pendingRestrictions: state.pendingRestrictions.map((restriction) => ({ ...restriction, column_names: restriction.column_names?.map(rename) })),
            pendingReferences: state.pendingReferences.map((reference) => ({ ...reference, column_name: rename(reference.column_name) })),
          } : {}),
        };
      });
      return rejectedEdits;
    };

    const showColumnEditWarnings = (rejectedEdits: ColumnGridDiagnostic[]) => {
      if (!rejectedEdits.length) return;
      const t = useI18nStore.getState().t;
      const reasons: Record<ColumnGridDiagnostic, { title: TranslationKey; description?: TranslationKey }> = {
        'name-required': { title: 'toast.columnNameRequired' },
        'duplicate-name': { title: 'toast.columnExists' },
        'type-required': { title: 'toast.columnTypeRequired' },
        'invalid-nullable': { title: 'toast.invalidNullable', description: 'toast.invalidNullableHelp' },
        'invalid-auto-increment': { title: 'toast.invalidAutoIncrement', description: 'toast.invalidAutoIncrementHelp' },
        'auto-type': { title: 'toast.invalidAutoIncrementType', description: 'column.autoIncrementTypesHelp' },
      };
      for (const reason of rejectedEdits) {
        const { title, description } = reasons[reason];
        useToastStore.getState().showToast({ type: 'warn', title: t(title), description: description ? t(description) : undefined });
      }
    };

    const editColumnGrid = (inputs: ColumnGridInput[]) => {
      if (!inputs.length) return;
      const rejectedEdits = applyColumnEdits(inputs);
      showColumnEditWarnings(rejectedEdits);
    };

    const addPendingColumn = (column: IPendingColumnCreate) => {
      set((state) => ({ pendingColumns: [...state.pendingColumns, column] }));
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

    const removePendingChangedColumns = (columnNames: string[]) => {
      const columnNamesSet = new Set(columnNames);

      set((state) => {
        const remaining = state.pendingChangedColumns.filter((column) =>
          !columnNamesSet.has(column.column_name) && !columnNamesSet.has(column.__originalColumn.column_name));
        return { pendingChangedColumns: remaining };
      });
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

    const setTableContext = (context: Partial<ITableContextState>) => {
      set(({ tableContext }) => ({
        tableContext: {
          ...tableContext,
          ...context,
        },
      }));
    };

    const setTableAppliedHandler = (handler?: (table: string) => void) => {
      set({ tableAppliedHandler: handler });
    };

    const setTableProperties = (properties: Partial<ITablePropertiesState>) => {
      set(({ tableProperties }) => ({
        tableProperties: {
          ...tableProperties,
          ...properties,
        },
      }));
    };

    const markTablePropertiesApplied = (tableName: string) => {
      set(({ tableProperties }) => ({
        tableProperties: {
          ...tableProperties,
          tableName,
          originalTableName: tableName,
          originalComment: tableProperties.supportsTableComments
            ? normalizeOptionalString(tableProperties.comment)
            : '',
        },
      }));
    };

    const clearPendingChanges = () => {
      pendingApplyInfo = null;
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

    const loadTableReferences: LoadTableInfo = (idConnection, filters, onlyIfMissing = false) =>
      loadTablePart('references', idConnection, filters, onlyIfMissing, async () => {
        const getTableReferences = useDatabaseStore.getState().getTableReferences;
        try {
          updateLoading('references', true);

          const items = await getTableReferences(idConnection, filters);

          set({ references: items || [] });
          updateFetchDate('references');
        } finally {
          updateLoading('references', false);
        }
      });

    const loadTableUsedAsReference: LoadTableInfo = (idConnection, filters, onlyIfMissing = false) =>
      loadTablePart('usedAsReference', idConnection, filters, onlyIfMissing, async () => {
        const getTableUsedAsReference = useDatabaseStore.getState().getTableUsedAsReference;
        try {
          updateLoading('usedAsReference', true);

          const items = await getTableUsedAsReference(idConnection, filters);

          set({ usedAsReference: items || [] });
          updateFetchDate('usedAsReference');
        } finally {
          updateLoading('usedAsReference', false);
        }
      });

    const loadTableRestrictions: LoadTableInfo = (idConnection, filters, onlyIfMissing = false) =>
      loadTablePart('restrictions', idConnection, filters, onlyIfMissing, async () => {
        const getTableRestrictions = useDatabaseStore.getState().getTableRestrictions;
        try {
          updateLoading('restrictions', true);

          const items = await getTableRestrictions(idConnection, filters);

          set({ restrictions: items || [] });
          updateFetchDate('restrictions');
        } finally {
          updateLoading('restrictions', false);
        }
      });

    const loadTableTriggers: LoadTableInfo = (idConnection, filters, onlyIfMissing = false) =>
      loadTablePart('triggers', idConnection, filters, onlyIfMissing, async () => {
        const getTableTriggers = useDatabaseStore.getState().getTableTriggers;
        try {
          updateLoading('triggers', true);

          const items = await getTableTriggers(idConnection, filters);

          set({ triggers: items || [] });
          updateFetchDate('triggers');
        } finally {
          updateLoading('triggers', false);
        }
      });

    const loadTableDefinition: LoadTableInfo = (idConnection, filters, onlyIfMissing = false) =>
      loadTablePart('definition', idConnection, filters, onlyIfMissing, async () => {
        const getTableDefinition = useDatabaseStore.getState().getTableDefinition;
        try {
          updateLoading('definition', true);

          const items = await getTableDefinition(idConnection, filters);

          set({ definition: items?.[0]?.definition || '' });
          updateFetchDate('definition');
        } finally {
          updateLoading('definition', false);
        }
      });

    const loadTableIndexes: LoadTableInfo = (idConnection, filters, onlyIfMissing = false) =>
      loadTablePart('indexes', idConnection, filters, onlyIfMissing, async () => {
        const getTableIndexes = useDatabaseStore.getState().getTableIndexes;
        try {
          updateLoading('indexes', true);

          const items = await getTableIndexes(idConnection, filters);

          set({ indexes: items || [] });
          updateFetchDate('indexes');
        } finally {
          updateLoading('indexes', false);
        }
      });

    const openPendingChangesSqlModal = async (
      idConnection: string,
      filters: ILoadTableInfoFilters,
      options?: IOpenPendingChangesSqlModalOptions,
    ) => {
      const context = get().tableContext;
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
      const tableProperties = get().tableProperties;
      const hasTableProperties =
        !!tableProperties.originalTableName || tableProperties.tableName !== '';
      const tableName = normalizeOptionalString(
        hasTableProperties ? tableProperties.tableName : filters.table,
      );
      const originalTableName = tableProperties.originalTableName || filters.table;
      const tableRenamed = tableName !== originalTableName;
      const tableComment = tableProperties.supportsTableComments
        ? tableProperties.comment
        : undefined;
      const tableCommentChanged =
        tableProperties.supportsTableComments &&
        normalizeOptionalString(tableProperties.comment) !== tableProperties.originalComment;

      if (options?.mode !== 'create' && tableRenamed && !tableName) {
        showToast({ type: 'warn', title: t('toast.tableNameRequired') });
        return;
      }

      if (options?.mode === 'create') {
        if (!tableName?.trim()) {
          showToast({ type: 'warn', title: t('toast.tableNameRequired') });
          return;
        }

        if (!pendingColumns.length) {
          showToast({ type: 'warn', title: t('toast.addAtLeastOneColumn') });
          return;
        }
      }

      const policyId = getConnectionDialect(idConnection);
      const baseChanges = {
        columns: pendingColumns.map(toStructureColumn),
        indexes: pendingIndexes.map(toStructureIndex),
        restrictions: pendingRestrictions.map(toStructureRestriction),
        references: pendingReferences.map(toStructureReference),
        tableComment,
      };
      let request: PrepareStructureDdlRequest;
      if (options?.mode === 'create') {
        request = {
          type: 'create-table',
          policyId,
          target: { schema: filters.schema, table: tableName },
          changes: baseChanges,
        };
      } else {
        request = {
          type: 'alter-table',
          policyId,
          target: { schema: filters.schema, table: filters.table },
          changes: {
            ...baseChanges,
            droppedColumns: pendingDroppedColumns.map(toStructureColumn),
            changedColumns: pendingChangedColumns.map((column) => ({
              original: toStructureColumn(column.__originalColumn),
              current: toStructureColumn(column),
            })),
            droppedIndexes: pendingDroppedIndexes.map(toStructureIndex),
            droppedRestrictions: pendingDroppedRestrictions.map(toStructureRestriction),
            droppedReferences: pendingDroppedReferences.map(toStructureReference),
            ...(pendingDroppedColumns.length ? {
              existingRestrictions: restrictions.map(toStructureRestriction),
              existingReferences: references.map(toStructureReference),
            } : {}),
            ...(pendingIndexes.length ? { existingColumns: columns.map(toStructureColumn) } : {}),
            newTableName: tableRenamed ? tableName : undefined,
            tableCommentChanged,
          },
        };
      }
      const applyInfo = { idConnection, filters, options, nextTable: tableName };
      pendingApplyInfo = applyInfo;
      const isCurrent = () => pendingApplyInfo === applyInfo && get().tableContext === context;
      const sql = await requestStructureDdl(request, isCurrent);
      if (!sql || !isCurrent()) return;
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

        const nextTable =
          applyInfo.nextTable || applyInfo.filters.table;
        const nextFilters = { ...applyInfo.filters, table: nextTable };

        markTablePropertiesApplied(nextTable);
        const onApplied = applyInfo.options?.onApplied || get().tableAppliedHandler;
        onApplied?.(nextTable);
        await Promise.all([
          loadConnectionInfo(applyInfo.idConnection, true),
          loadTableColumns(applyInfo.idConnection, nextFilters),
          loadTableRestrictions(applyInfo.idConnection, nextFilters),
          loadTableReferences(applyInfo.idConnection, nextFilters),
          loadTableIndexes(applyInfo.idConnection, nextFilters),
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
      editColumnGrid,
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
      columnTypeEligibility: {},
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
      tableContext: {
        idConnection: '',
        schema: '',
        table: '',
        mode: 'view',
        objectType: 'table',
        supportsIndexes: true,
        supportsTriggers: true,
        supportsTableComments: false,
        dialect: 'postgres',
      },
      tableAppliedHandler: undefined,
      tableProperties: {
        tableName: '',
        originalTableName: '',
        comment: '',
        originalComment: '',
        supportsTableComments: false,
      },
      setTableContext,
      setTableAppliedHandler,
      setTableProperties,
      markTablePropertiesApplied,
      loadTableColumns,
      loadColumnTypes,
      addPendingColumn,
      removePendingColumn,
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
      closePendingDdlModal: () => {
        pendingApplyInfo = null;
        set({ showPendingDdlModal: false });
      },
    };
  });

export type TableInfoStoreApi = ReturnType<typeof createTableInfoStore>;

export const useTableInfoStore = <T>(
  store: TableInfoStoreApi,
  selector: (state: ITableInfoStore) => T,
) => useStore(store, selector);
