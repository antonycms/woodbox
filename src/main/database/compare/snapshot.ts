import type {
  DatabaseCompareObjectSelection,
  DatabaseCompareOptions,
} from '@shared/types/databaseCompare';
import type { IConnection } from '../types';
import type { ITableWithSchema } from '../dialects';
import { getDialectAdapter } from '../dialects';
import type {
  ColumnInfo,
  ConnectionGetter,
  FunctionInfo,
  ReferenceInfo,
  RestrictionInfo,
  Row,
  RuleInfo,
  SequenceInfo,
  Snapshot,
  TableInfo,
  TriggerInfo,
  IndexInfo,
} from './types';
import { functionKey, mapWithConcurrency, objectKey } from './utils';

const getRawRows = async (connection: IConnection, sql?: string) => {
  if (!sql) return [] as Row[];

  const adapter = getDialectAdapter(connection.dialect);
  const raw = await connection.instance.raw(sql);

  return adapter.getRows(raw) as Row[];
};

const fetchTable = async (
  connection: IConnection,
  table: TableInfo,
  options: DatabaseCompareOptions,
) => {
  const adapter = getDialectAdapter(connection.dialect);
  const query = adapter.queries;
  const params: ITableWithSchema = { table: table.table_name, schema: table.table_schema };
  const isTable = (table.object_type || 'table') === 'table';
  const shouldLoadTableParts = isTable && options.compareTables;

  const [definition, columns, restrictions, references, indexes, triggers, rules, owner] =
    await Promise.all([
      getRawRows(connection, query.getTableDefinition(params)).then((rows) => rows[0]?.definition),
      shouldLoadTableParts ? getRawRows(connection, query.getTableColumns(params)) : [],
      shouldLoadTableParts ? getRawRows(connection, query.getTableRestrictions(params)) : [],
      shouldLoadTableParts && options.compareForeignKeys
        ? getRawRows(connection, query.getTableReferences(params))
        : [],
      shouldLoadTableParts && options.compareIndexes
        ? getRawRows(connection, query.getTableIndexes(params))
        : [],
      shouldLoadTableParts && options.compareTriggers
        ? getRawRows(connection, query.getTableTriggers(params))
        : [],
      shouldLoadTableParts && options.compareRules && query.getTableRules
        ? getRawRows(connection, query.getTableRules(params))
        : [],
      options.compareOwners && query.getTableOwner
        ? getRawRows(connection, query.getTableOwner(params)).then((rows) => rows[0]?.owner_name)
        : undefined,
    ]);

  return {
    ...table,
    definition: String(definition || ''),
    owner_name: owner ? String(owner) : undefined,
    columns: columns as ColumnInfo[],
    restrictions: restrictions as RestrictionInfo[],
    references: references as ReferenceInfo[],
    indexes: indexes as IndexInfo[],
    triggers: triggers as TriggerInfo[],
    rules: rules as RuleInfo[],
  };
};

const fetchFunctions = async (
  connection: IConnection,
  schemaFilter: Set<string>,
  functionFilter: Set<string>,
  options: DatabaseCompareOptions,
) => {
  if (!options.compareFunctions) return new Map<string, FunctionInfo>();

  const adapter = getDialectAdapter(connection.dialect);
  const query = adapter.queries;
  if (!query.getFunctions || !query.getFunctionDefinition) return new Map<string, FunctionInfo>();

  const rows = await getRawRows(connection, query.getFunctions());
  const functions = new Map<string, FunctionInfo>();

  await mapWithConcurrency(
    rows,
    async (row) => {
      const schema = String(row.function_schema || '');
      if (schemaFilter.size && !schemaFilter.has(schema)) return;

      const functionName = String(row.function_name || '');
      const functionIdentityArguments = String(row.function_identity_arguments || '');
      if (
        functionFilter.size &&
        !functionFilter.has(functionKey(schema, functionName, functionIdentityArguments))
      ) {
        return;
      }

      const params = { schema, functionName, functionIdentityArguments };
      const [definitionRows, ownerRows] = await Promise.all([
        getRawRows(connection, query.getFunctionDefinition?.(params)),
        options.compareOwners && query.getFunctionOwner
          ? getRawRows(connection, query.getFunctionOwner(params))
          : [],
      ]);
      const definition = definitionRows.map((item) => item.definition).filter(Boolean).join('\n\n');
      const key = functionKey(schema, functionName, functionIdentityArguments);

      functions.set(key, {
        ...row,
        function_schema: schema,
        function_name: functionName,
        function_identity_arguments: functionIdentityArguments,
        definition,
        owner_name: ownerRows[0]?.owner_name ? String(ownerRows[0].owner_name) : undefined,
      });
    },
  );

  return functions;
};

const fetchSequences = async (
  connection: IConnection,
  schemaFilter: Set<string>,
  options: DatabaseCompareOptions,
) => {
  if (!options.compareSequences) return new Map<string, SequenceInfo>();

  const adapter = getDialectAdapter(connection.dialect);
  const query = adapter.queries;
  if (!query.getSequences) return new Map<string, SequenceInfo>();

  const rows = (await getRawRows(connection, query.getSequences())) as SequenceInfo[];
  const sequences = new Map<string, SequenceInfo>();

  rows.forEach((row) => {
    const schema = row.sequence_schema || '';
    if (schemaFilter.size && !schemaFilter.has(schema)) return;

    sequences.set(objectKey(schema, row.sequence_name), row);
  });

  return sequences;
};

export const getSnapshot = async (
  connectionId: string,
  selectedObjects: DatabaseCompareObjectSelection[],
  options: DatabaseCompareOptions,
  getConnection: ConnectionGetter,
) => {
  const connection = await getConnection(connectionId);
  const adapter = getDialectAdapter(connection.dialect);
  const query = adapter.queries;
  const selectedTableObjects = selectedObjects.filter((item) => (item.type || 'table') === 'table');
  const selectedFunctionObjects = selectedObjects.filter((item) => item.type === 'function');
  const selectedTableKeys = new Set(
    selectedTableObjects.map((item) =>
      objectKey(item.schema, item.table || item.name || '', options.ignoreTableNameCase),
    ),
  );
  const selectedFunctionKeys = new Set(
    selectedFunctionObjects.map((item) =>
      functionKey(item.schema, item.name || item.table || '', item.functionIdentityArguments),
    ),
  );
  const schemaFilter = new Set(selectedObjects.map((item) => item.schema || '').filter(Boolean));
  const tablesRaw = (await getRawRows(connection, query.getTables())) as TableInfo[];
  const filteredTables = tablesRaw.filter((table) => {
    if (selectedObjects.length && !selectedTableObjects.length) return false;

    const objectType = table.object_type || 'table';
    if (objectType === 'table' && !options.compareTables) return false;
    if ((objectType === 'view' || objectType === 'materialized_view') && !options.compareViews) {
      return false;
    }
    if (!selectedTableKeys.size) return true;

    return selectedTableKeys.has(
      objectKey(table.table_schema, table.table_name, options.ignoreTableNameCase),
    );
  });
  const tables = new Map<string, TableInfo>();

  await mapWithConcurrency(
    filteredTables,
    async (table) => {
      const completeTable = await fetchTable(connection, table, options);
      tables.set(
        objectKey(table.table_schema, table.table_name, options.ignoreTableNameCase),
        completeTable,
      );
    },
  );

  const [functions, sequences] = await Promise.all([
    fetchFunctions(connection, schemaFilter, selectedFunctionKeys, options),
    fetchSequences(connection, schemaFilter, options),
  ]);

  return { connection, tables, functions, sequences } satisfies Snapshot;
};

