import { z } from 'zod';

const optionalStringFromNullable = z.preprocess(
  (value) => (value === null ? undefined : value),
  z.string().optional(),
);

export const tableFilters = z.object({ table: z.string(), schema: optionalStringFromNullable });
const orderBy = z.array(z.object({ columnName: z.string(), sortType: z.enum(['ASC', 'DESC']) }));
export const tableData = tableFilters.extend({
  page: z.number(), limit: z.number().optional(), where: z.string().optional(),
  orderBy: orderBy.optional(),
});
export const runSqlOptions = z.object({
  limit: z.number().optional(), page: z.number().optional(), orderBy: orderBy.optional(),
  queryExecutionId: z.string().optional(),
  rowChangesTransaction: tableFilters.extend({ table: z.string().min(1) }).optional(),
});
const exportSource = z.discriminatedUnion('type', [
  tableFilters.extend({ type: z.literal('table'), where: z.string().optional(), orderBy: orderBy.optional() }),
  z.object({ type: z.literal('query'), sql: z.string(), orderBy: orderBy.optional() }),
]);
export const exportPreview = z.object({ source: exportSource });
export const exportData = exportPreview.extend({
  columns: z.array(z.string()), format: z.enum(['csv', 'json', 'jsonl', 'xlsx', 'clipboard']),
  batchSize: z.number().optional(), fileName: z.string().optional(),
});
export const importTableData = tableFilters.extend({
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.date(), z.null()]))),
});

export const queryRowUpdates = z.array(tableFilters.extend({
  table: z.string().min(1),
  primaryKey: z.record(z.string().min(1), z.union([z.string(), z.number().finite(), z.boolean()])),
  changes: z.record(z.string().min(1), z.json()),
}));

export const queryResultColumns = z.object({
  sql: z.string(),
  columns: z.array(z.object({
    name: z.string(), type: z.string().optional(), source_ref: z.string().max(64).optional(),
    source: z.object({ schema: z.string().optional(), table: z.string().min(1), column: z.string().min(1) }).optional(),
  })),
});

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
