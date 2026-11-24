import type { DatabaseRow } from '@shared/types/database';
import { z } from 'zod';

const optionalStringFromNullable = z.preprocess(
  (value) => (value === null ? undefined : value),
  z.string().optional(),
);

export const prepareInitialWhere = z.object({
  table: z.string().min(1), schema: optionalStringFromNullable, column: z.string().min(1), value: z.unknown(),
  includeColumns: z.boolean().optional(),
}).strict().refine((value) => Object.hasOwn(value, 'value'));
export const readInitialWhere = z.object({
  table: z.string().min(1), schema: optionalStringFromNullable, column: z.string().min(1), value: z.unknown(),
  includeColumns: z.boolean().optional(),
  page: z.number().int().min(1).optional(), limit: z.number().int().min(0).optional(),
  orderBy: z.array(z.object({ columnName: z.string(), sortType: z.enum(['ASC', 'DESC']) })).optional(),
}).strict().refine((value) => Object.hasOwn(value, 'value'));

export const tableFilters = z.object({ table: z.string(), schema: optionalStringFromNullable });
export const tableReadFilters = tableFilters.extend({ where: z.string().optional() }).strict();
const orderBy = z.array(z.object({ columnName: z.string(), sortType: z.enum(['ASC', 'DESC']) }));
export const tableData = tableFilters.extend({
  page: z.number(), limit: z.number().optional(), orderBy: orderBy.optional(),
  where: z.string().optional(),
}).strict();
const objectName = z.string().min(1);
const newObjectName = objectName.refine((value) => value.trim().length > 0);
export const objectCommand = z.discriminatedUnion('type', [
  z.object({ type: z.literal('create-schema'), schema: newObjectName }),
  z.object({ type: z.literal('rename-schema'), schema: objectName, newName: newObjectName }),
  z.object({ type: z.literal('drop-schema'), schema: objectName, cascade: z.boolean() }),
  z.object({ type: z.literal('rename-table'), schema: optionalStringFromNullable, table: objectName, newName: newObjectName }),
  z.object({ type: z.literal('drop-table'), schema: optionalStringFromNullable, table: objectName }),
]);
export const runSqlOptions = z.object({
  limit: z.number().optional(), page: z.number().optional(), orderBy: orderBy.optional(),
  queryExecutionId: z.string().optional(),
  columnTypes: z.array(z.object({ name: z.string(), type: z.string().optional() })).optional(),
});
const exportSource = z.union([
  tableReadFilters.extend({ type: z.literal('table'), orderBy: orderBy.optional() }),
  z.object({ type: z.literal('query'), sql: z.string(), orderBy: orderBy.optional() }),
]);
export const exportPreview = z.object({ source: exportSource });
export const exportData = exportPreview.extend({
  exportId: z.string().uuid(),
  columns: z.array(z.string()), format: z.enum(['csv', 'json', 'jsonl', 'xlsx', 'clipboard']),
  batchSize: z.number().optional(), fileName: z.string().optional(),
});
export const importTableData = tableFilters.extend({
  importId: z.string().uuid(),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.date(), z.null()]))),
});

const queryResultColumns = z.object({
  sql: z.string(),
  columns: z.array(z.object({
    name: z.string(), type: z.string().optional(), source_ref: z.string().max(64).optional(),
    source: z.object({ schema: z.string().optional(), table: z.string().min(1), column: z.string().min(1) }).optional(),
  })),
});

// z.record removes an own '__proto__' column; preserve every real column and present undefined.
const rowChangesRow = z.custom<Record<string, unknown>>((value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  && Object.keys(value).every((key) => key.length > 0),
);
const rowChangesFilters = rowChangesRow.refine((row) => Object.keys(row).length > 0);
export const rowChangesIntent = z.union([z.object({
  source: queryResultColumns.extend({ type: z.literal('query') }),
  inserts: z.array(rowChangesRow),
  updates: z.array(z.object({ original: rowChangesRow, changes: rowChangesRow })),
  deletes: z.array(rowChangesRow),
}), z.object({
  source: z.object({ type: z.literal('table'), schema: z.string().optional(), table: z.string().min(1) }),
  inserts: z.array(rowChangesRow),
  updates: z.array(z.object({ filters: rowChangesFilters, values: rowChangesRow })),
  deletes: z.array(rowChangesFilters),
})]);

export const compare = z.object({
  sourceConnectionId: z.string(), targetConnectionId: z.string(),
  selectedObjects: z.array(z.object({
    type: z.enum(['table', 'function']).optional(), schema: z.string().optional(),
    table: z.string().optional(), name: z.string().optional(),
    functionIdentityArguments: z.string().optional(),
  })),
  options: z.object({
    compareTables: z.boolean(),
    comparePrimaryKeys: z.boolean(),
    compareForeignKeys: z.boolean(),
    compareUniqueKeys: z.boolean(),
    compareCheckConstraints: z.boolean(),
    compareExclusionConstraints: z.boolean(),
    compareViews: z.boolean(),
    compareFunctions: z.boolean(),
    compareIndexes: z.boolean(),
    compareSequences: z.boolean(),
    compareTriggers: z.boolean(),
    compareRules: z.boolean(),
    compareOwners: z.boolean(),
    useCascadeDelete: z.boolean(),
    compareSequenceLastValues: z.boolean(),
    compareColumnOrder: z.boolean(),
    ignoreTableNameCase: z.boolean(),
    ignoreColumnNameCase: z.boolean(),
    detectRenames: z.boolean(),
    detectTableRenames: z.boolean(),
    enableRollback: z.boolean(),
  }),
});

const ddlMetadataBoolean = z.preprocess(
  (value) => (value === 0 ? false : value === 1 ? true : value),
  z.boolean(),
);
const ddlColumn = z.object({
  column_name: z.string(),
  data_type: z.string(),
  is_nullable: ddlMetadataBoolean,
  is_auto_increment: optionalBooleanFromNullable(),
  column_default: optionalStringFromNullable,
  description: optionalStringFromNullable,
  udt_name: optionalStringFromNullable,
  extra: optionalStringFromNullable,
  character_maximum_length: optionalNumberFromNullable(),
  numeric_precision: optionalNumberFromNullable(),
  numeric_scale: optionalNumberFromNullable(),
  datetime_precision: optionalNumberFromNullable(),
}).strict();
function optionalBooleanFromNullable() {
  return z.preprocess(
    (value) => (value === null ? undefined : value),
    ddlMetadataBoolean.optional(),
  );
}
function optionalNumberFromNullable() {
  return z.preprocess((value) => (value === null ? undefined : value), z.number().optional());
}
const ddlRestriction = z
  .object({
    constraint_name: z.string(),
    constraint_type: z.enum(['primary_key', 'unique_key', 'check', 'exclusion']),
    constraint_definition: optionalStringFromNullable,
    column_names: z.preprocess(
      (value) => (value === null ? undefined : value),
      z.array(z.string()).optional(),
    ),
    expression: optionalStringFromNullable,
    comment: optionalStringFromNullable,
  })
  .strict();
const ddlReference = z
  .object({
    constraint_name: z.string(),
    column_name: z.string(),
    reference_table_schema: z.preprocess((value) => (value == null ? '' : value), z.string()),
    reference_table_name: z.string(),
    reference_column_name: z.preprocess((value) => (value == null ? '' : value), z.string()),
    constraint_definition: optionalStringFromNullable,
    comment: optionalStringFromNullable,
  })
  .strict();
const ddlIndex = z
  .object({
    index_name: z.string(),
    index_method: z.string(),
    column_names: z.preprocess(
      (value) => (value === null ? undefined : value),
      z.array(z.string()).optional(),
    ),
    column_orders: z.preprocess(
      (value) => (value === null ? undefined : value),
      z.array(z.enum(['ASC', 'DESC'])).optional(),
    ),
    is_unique: ddlMetadataBoolean,
    is_primary: ddlMetadataBoolean,
  })
  .strict();
const ddlSource = z.enum(['loaded', 'draft']);
const ddlContext = {
  policyId: z.enum(['postgres', 'mysql', 'sqlite', 'react-native-sqlite']),
  target: z.object({ schema: z.string().optional(), table: z.string() }).strict(),
};
const ddlChanges = z
  .object({
    columns: z.array(ddlColumn),
    indexes: z.array(ddlIndex).optional(),
    restrictions: z.array(ddlRestriction).optional(),
    references: z.array(ddlReference).optional(),
    tableComment: optionalStringFromNullable,
  })
  .strict();
export const prepareStructureDdl = z.discriminatedUnion('type', [
  z.object({ ...ddlContext, type: z.literal('create-table'), changes: ddlChanges }).strict(),
  z
    .object({
      ...ddlContext,
      type: z.literal('alter-table'),
      changes: ddlChanges.extend({
        droppedColumns: z.array(ddlColumn).optional(),
        changedColumns: z
          .array(z.object({ original: ddlColumn, current: ddlColumn }).strict())
          .optional(),
        droppedIndexes: z.array(ddlIndex).optional(),
        droppedRestrictions: z.array(ddlRestriction).optional(),
        droppedReferences: z.array(ddlReference).optional(),
        existingColumns: z.array(ddlColumn).optional(),
        existingRestrictions: z.array(ddlRestriction).optional(),
        existingReferences: z.array(ddlReference).optional(),
        newTableName: z.string().optional(),
        tableCommentChanged: z.boolean().optional(),
      }),
    })
    .strict(),
  z
    .object({
      ...ddlContext,
      type: z.literal('add-columns'),
      columns: z.array(ddlColumn),
      restrictions: z.array(ddlRestriction),
      references: z.array(ddlReference),
    })
    .strict(),
  z
    .object({
      ...ddlContext,
      type: z.literal('references'),
      references: z.array(ddlReference.extend({ source: ddlSource })),
    })
    .strict(),
  z
    .object({
      ...ddlContext,
      type: z.literal('restrictions'),
      restrictions: z.array(ddlRestriction.extend({ source: ddlSource })),
    })
    .strict(),
]);

// Keep own column names (including '__proto__') and present undefined values.
const insertDmlRow = z.custom<DatabaseRow>(
  (value) =>
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null),
);
export const prepareInsertDml = z
  .object({
    policyId: z.enum(['postgres', 'mysql', 'sqlite', 'react-native-sqlite']),
    target: z.object({ schema: z.string().optional(), table: z.string() }).strict(),
    rows: z.array(insertDmlRow),
    columnOrder: z.array(z.string()).optional(),
  })
  .strict();
