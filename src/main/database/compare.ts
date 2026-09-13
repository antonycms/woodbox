
import { getCompareDdlBuilder, type CompareDdlBuilder, type CompareColumnChanges } from './compareDdl';
import { getDialectAdapter, type ITableWithSchema } from './dialects';

export type DatabaseCompareOperation = 'create' | 'modify' | 'delete' | 'none';
export type DatabaseCompareKind =
  | 'table'
  | 'view'
  | 'materialized_view'
  | 'column'
  | 'primary_key'
  | 'foreign_key'
  | 'unique_key'
  | 'check'
  | 'exclusion'
  | 'index'
  | 'trigger'
  | 'rule'
  | 'function'
  | 'sequence'
  | 'owner';

export interface DatabaseCompareOptions {
  compareTables: boolean;
  comparePrimaryKeys: boolean;
  compareForeignKeys: boolean;
  compareUniqueKeys: boolean;
  compareCheckConstraints: boolean;
  compareExclusionConstraints: boolean;
  compareViews: boolean;
  compareFunctions: boolean;
  compareIndexes: boolean;
  compareSequences: boolean;
  compareTriggers: boolean;
  compareRules: boolean;
  compareOwners: boolean;
  useCascadeDelete: boolean;
  compareSequenceLastValues: boolean;
  compareColumnOrder: boolean;
  ignoreTableNameCase: boolean;
  ignoreColumnNameCase: boolean;
  detectRenames: boolean;
  detectTableRenames: boolean;
  enableRollback: boolean;
}

export interface DatabaseCompareObjectSelection {
  type?: 'table' | 'function';
  schema?: string;
  table?: string;
  name?: string;
  functionIdentityArguments?: string;
}

export interface DatabaseCompareParams {
  sourceConnectionId: string;
  targetConnectionId: string;
  selectedObjects: DatabaseCompareObjectSelection[];
  options: DatabaseCompareOptions;
}

export interface DatabaseCompareItemEndpoint {
  schema?: string;
  name: string;
  parentName?: string;
}

export interface DatabaseCompareItem {
  id: string;
  operation: DatabaseCompareOperation;
  kind: DatabaseCompareKind;
  label: string;
  source?: DatabaseCompareItemEndpoint;
  target?: DatabaseCompareItemEndpoint;
  ddl?: string;
  rollbackDdl?: string;
  details?: string[];
}

export interface DatabaseCompareResult {
  items: DatabaseCompareItem[];
  warnings: string[];
  summary: Record<DatabaseCompareOperation, number>;
}

type ConnectionGetter = (connectionId: string) => Promise<IConnection>;
type Row = Record<string, unknown>;
type DbObjectType = 'table' | 'view' | 'materialized_view';
type ConstraintType = 'primary_key' | 'unique_key' | 'check' | 'exclusion';

type ColumnInfo = Row & {
  column_name: string;
  data_type?: string;
  udt_name?: string;
  is_nullable?: boolean;
  column_default?: string;
  is_auto_increment?: boolean;
};

type RestrictionInfo = Row & {
  constraint_name: string;
  constraint_type?: ConstraintType;
  constraint_definition?: string;
  column_names?: string[] | string;
  expression?: string;
};

type ReferenceInfo = Row & {
  constraint_name: string;
  column_name: string;
  reference_table_schema?: string;
  reference_table_name: string;
  reference_column_name: string;
  constraint_definition?: string;
  constraint_order?: number | string;
  remove_rule?: string;
  update_rule?: string;
};

type ForeignKeyInfo = Row & {
  constraint_name: string;
  column_names: string[];
  reference_table_schema?: string;
  reference_table_name: string;
  reference_column_names: string[];
  constraint_definition?: string;
  remove_rule?: string;
  update_rule?: string;
};

type IndexInfo = Row & {
  index_name: string;
  index_method?: string;
  is_unique?: boolean;
  is_primary?: boolean;
  column_names?: string[] | string;
  column_orders?: string[] | string;
  expression?: string;
  predicate?: string;
  index_definition?: string;
};

type TriggerInfo = Row & { trigger_name: string; trigger_definition?: string };
type RuleInfo = Row & { rule_name: string; rule_definition?: string };

type FunctionInfo = Row & {
  function_schema?: string;
  function_name: string;
  function_identity_arguments?: string;
  definition?: string;
  owner_name?: string;
};

type SequenceInfo = Row & {
  sequence_schema?: string;
  sequence_name: string;
  sequence_definition?: string;
  owner_name?: string;
  last_value?: unknown;
};

type TableInfo = Row & {
  table_schema?: string;
  table_name: string;
  object_type?: DbObjectType;
  definition?: string;
  owner_name?: string;
  columns?: ColumnInfo[];
  restrictions?: RestrictionInfo[];
  references?: ReferenceInfo[];
  indexes?: IndexInfo[];
  triggers?: TriggerInfo[];
  rules?: RuleInfo[];
};

type Snapshot = {
  connection: IConnection;
  tables: Map<string, TableInfo>;
  functions: Map<string, FunctionInfo>;
  sequences: Map<string, SequenceInfo>;
};

const objectTypeLabel: Record<DbObjectType, string> = {
  table: 'tabela',
  view: 'view',
  materialized_view: 'view materializada',
};

const normalizeName = (value: string | undefined, ignoreCase?: boolean) => {
  const normalized = value || '';
  return ignoreCase ? normalized.toLowerCase() : normalized;
};

const objectKey = (schema: string | undefined, name: string, ignoreCase?: boolean) =>
  `${schema || ''}\0${normalizeName(name, ignoreCase)}`;

const functionKey = (schema: string | undefined, name: string, identityArguments?: string) =>
  `${schema || ''}\0${name}\0${identityArguments || ''}`;

const qualifiedName = (
  quoteIdentifier: (value: string) => string,
  schema: string | undefined,
  name: string,
) => (schema ? `${quoteIdentifier(schema)}.${quoteIdentifier(name)}` : quoteIdentifier(name));

const endpoint = (schema: string | undefined, name: string, parentName?: string) => ({
  schema,
  name,
  parentName,
});

const normalizeSql = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/;$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

const normalizeOptional = (value: unknown) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

const parseArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === null || value === '') return [];

  const text = String(value);

  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }

  return text.split(',').map((item) => item.trim()).filter(Boolean);
};

const normalizeIdentifierList = (value: unknown, ignoreCase?: boolean) =>
  parseArray(value).map((item) => normalizeName(item, ignoreCase));

const normalizeForCompare = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeForCompare);
  if (!value || typeof value !== 'object') return value ?? '';

  const source = value as Row;
  return Object.keys(source)
    .sort()
    .reduce<Row>((acc, key) => {
      acc[key] = normalizeForCompare(source[key]);
      return acc;
    }, {});
};

const stableStringify = (value: unknown) => JSON.stringify(normalizeForCompare(value));

const pushSemicolon = (sql: string) => {
  const text = sql.trim();
  if (!text) return '';
  return text.endsWith(';') ? text : `${text};`;
};

const MAX_METADATA_CONCURRENCY = 6;

const mapWithConcurrency = async <T>(
  items: T[],
  mapper: (item: T, index: number) => Promise<void>,
  concurrency = MAX_METADATA_CONCURRENCY,
) => {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
};

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

const getSnapshot = async (
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

const makeItemFactory = () => {
  let index = 0;

  return (item: Omit<DatabaseCompareItem, 'id'>): DatabaseCompareItem => ({
    ...item,
    id: `diff_${++index}`,
  });
};

const columnTypeSignature = (column: ColumnInfo) =>
  stableStringify({
    type: normalizeOptional(column.data_type).toLowerCase(),
    udt: normalizeOptional(column.udt_name).toLowerCase(),
    length: column.character_maximum_length || '',
    precision: column.numeric_precision || '',
    scale: column.numeric_scale || '',
    datetimePrecision: column.datetime_precision || '',
    autoIncrement: Boolean(column.is_auto_increment),
  });

const columnDefaultSignature = (column: ColumnInfo) => {
  const defaultSql = normalizeSql(column.column_default);

  if (/^nextval\s*\(/i.test(defaultSql)) return 'nextval(*)';

  return defaultSql;
};

const columnSignature = (column: ColumnInfo, index: number, options: DatabaseCompareOptions) =>
  stableStringify({
    order: options.compareColumnOrder ? index : undefined,
    name: normalizeName(column.column_name, options.ignoreColumnNameCase),
    type: columnTypeSignature(column),
    nullable: Boolean(column.is_nullable),
    default: columnDefaultSignature(column),
  });

const columnBodySignature = (column: ColumnInfo) =>
  stableStringify({
    type: columnTypeSignature(column),
    nullable: Boolean(column.is_nullable),
    default: columnDefaultSignature(column),
  });

const compareNamedList = <T extends Row>(params: {
  items: DatabaseCompareItem[];
  addItem: ReturnType<typeof makeItemFactory>;
  sourceRows: T[];
  targetRows: T[];
  getName(row: T): string;
  getSignature(row: T): string;
  getLabelName?(row: T, name: string): string;
  getKind?(row: T): DatabaseCompareKind;
  createDdl(row: T): string;
  deleteDdl(row: T): string;
  label: string;
  kind: DatabaseCompareKind;
  schema?: string;
  parentName?: string;
  enableRollback: boolean;
}) => {
  const sourceByName = new Map(params.sourceRows.map((row) => [params.getName(row), row]));
  const targetByName = new Map(params.targetRows.map((row) => [params.getName(row), row]));
  const names = new Set([...sourceByName.keys(), ...targetByName.keys()]);

  names.forEach((name) => {
    const source = sourceByName.get(name);
    const target = targetByName.get(name);
    const displayRow = source || target;
    const displayName = displayRow && params.getLabelName ? params.getLabelName(displayRow, name) : name;
    const objectLabel = `${params.label} ${displayName}`;

    if (source && !target) {
      params.items.push(
        params.addItem({
          operation: 'create',
          kind: params.getKind?.(source) || params.kind,
          label: objectLabel,
          source: endpoint(params.schema, displayName, params.parentName),
          ddl: params.createDdl(source),
          rollbackDdl: params.enableRollback ? params.deleteDdl(source) : undefined,
        }),
      );
      return;
    }

    if (!source && target) {
      params.items.push(
        params.addItem({
          operation: 'delete',
          kind: params.getKind?.(target) || params.kind,
          label: objectLabel,
          target: endpoint(params.schema, displayName, params.parentName),
          ddl: params.deleteDdl(target),
          rollbackDdl: params.enableRollback ? params.createDdl(target) : undefined,
        }),
      );
      return;
    }

    if (source && target && params.getSignature(source) !== params.getSignature(target)) {
      params.items.push(
        params.addItem({
          operation: 'modify',
          kind: params.getKind?.(source) || params.kind,
          label: objectLabel,
          source: endpoint(
            params.schema,
            params.getLabelName ? params.getLabelName(source, name) : name,
            params.parentName,
          ),
          target: endpoint(
            params.schema,
            params.getLabelName ? params.getLabelName(target, name) : name,
            params.parentName,
          ),
          ddl: [params.deleteDdl(target), params.createDdl(source)].filter(Boolean).join('\n\n'),
          rollbackDdl: params.enableRollback
            ? [params.deleteDdl(source), params.createDdl(target)].filter(Boolean).join('\n\n')
            : undefined,
        }),
      );
    }
  });
};

const compareColumns = (
  items: DatabaseCompareItem[],
  addItem: ReturnType<typeof makeItemFactory>,
  sourceTable: TableInfo,
  targetTable: TableInfo,
  params: {
    options: DatabaseCompareOptions;
    quoteIdentifier(value: string): string;
    ddl: CompareDdlBuilder;
  },
) => {
  const tableName = qualifiedName(
    params.quoteIdentifier,
    sourceTable.table_schema,
    sourceTable.table_name,
  );
  const sourceColumns = sourceTable.columns || [];
  const targetColumns = targetTable.columns || [];
  const sourceByName = new Map(
    sourceColumns.map((column, index) => [
      normalizeName(column.column_name, params.options.ignoreColumnNameCase),
      { column, index },
    ]),
  );
  const targetByName = new Map(
    targetColumns.map((column, index) => [
      normalizeName(column.column_name, params.options.ignoreColumnNameCase),
      { column, index },
    ]),
  );
  const sourceMissing = [...sourceByName].filter(([name]) => !targetByName.has(name));
  const targetMissing = [...targetByName].filter(([name]) => !sourceByName.has(name));
  const handledSourceMissing = new Set<string>();
  const handledTargetMissing = new Set<string>();

  if (params.options.detectRenames) {
    sourceMissing.forEach(([sourceName, source]) => {
      const targetMatch = targetMissing.find(
        ([targetName, target]) =>
          !handledTargetMissing.has(targetName) &&
          columnBodySignature(source.column) === columnBodySignature(target.column),
      );

      if (!targetMatch) return;

      const [targetName, target] = targetMatch;
      handledSourceMissing.add(sourceName);
      handledTargetMissing.add(targetName);
      items.push(
        addItem({
          operation: 'modify',
          kind: 'column',
          label: `${tableName}.${source.column.column_name}: renomear coluna`,
          source: endpoint(sourceTable.table_schema, source.column.column_name, sourceTable.table_name),
          target: endpoint(targetTable.table_schema, target.column.column_name, targetTable.table_name),
          ddl: `ALTER TABLE ${tableName}\n  RENAME COLUMN ${params.quoteIdentifier(
            target.column.column_name,
          )} TO ${params.quoteIdentifier(source.column.column_name)};`,
          rollbackDdl: params.options.enableRollback
            ? `ALTER TABLE ${tableName}\n  RENAME COLUMN ${params.quoteIdentifier(
                source.column.column_name,
              )} TO ${params.quoteIdentifier(target.column.column_name)};`
            : undefined,
        }),
      );
    });
  }

  sourceMissing.forEach(([name, source]) => {
    if (handledSourceMissing.has(name)) return;

    items.push(
      addItem({
        operation: 'create',
        kind: 'column',
        label: `${tableName}.${source.column.column_name}`,
        source: endpoint(sourceTable.table_schema, source.column.column_name, sourceTable.table_name),
        ddl: params.ddl.addColumn(tableName, source.column),
        rollbackDdl: params.options.enableRollback
          ? params.ddl.dropColumn(tableName, source.column.column_name)
          : undefined,
      }),
    );
  });

  targetMissing.forEach(([name, target]) => {
    if (handledTargetMissing.has(name)) return;

    items.push(
      addItem({
        operation: 'delete',
        kind: 'column',
        label: `${tableName}.${target.column.column_name}`,
        target: endpoint(targetTable.table_schema, target.column.column_name, targetTable.table_name),
        ddl: params.ddl.dropColumn(tableName, target.column.column_name),
        rollbackDdl: params.options.enableRollback
          ? params.ddl.addColumn(tableName, target.column)
          : undefined,
      }),
    );
  });

  sourceByName.forEach((source, name) => {
    const target = targetByName.get(name);
    if (!target) return;

    if (
      columnSignature(source.column, source.index, params.options) ===
      columnSignature(target.column, target.index, params.options)
    ) {
      return;
    }

    const details: string[] = [];
    const typeChanged = columnTypeSignature(source.column) !== columnTypeSignature(target.column);
    const nullableChanged = Boolean(source.column.is_nullable) !== Boolean(target.column.is_nullable);
    const defaultChanged = columnDefaultSignature(source.column) !== columnDefaultSignature(target.column);
    const changes: CompareColumnChanges = { typeChanged, nullableChanged, defaultChanged };

    if (typeChanged) {
      details.push('O tipo da coluna difere entre origem e destino.');
    }

    if (nullableChanged) {
      details.push('A nulabilidade da coluna difere entre origem e destino.');
    }

    if (defaultChanged) {
      details.push('O valor padrão da coluna difere entre origem e destino.');
    }

    const ddlParts = params.ddl.alterColumn(
      tableName,
      source.column.column_name,
      source.column,
      target.column,
      changes,
    );
    const rollbackParts = params.options.enableRollback
      ? params.ddl.alterColumn(
          tableName,
          target.column.column_name,
          target.column,
          source.column,
          changes,
        )
      : [];

    items.push(
      addItem({
        operation: 'modify',
        kind: 'column',
        label: `${tableName}.${source.column.column_name}`,
        source: endpoint(sourceTable.table_schema, source.column.column_name, sourceTable.table_name),
        target: endpoint(targetTable.table_schema, target.column.column_name, targetTable.table_name),
        ddl: ddlParts.filter(Boolean).join('\n\n'),
        rollbackDdl: params.options.enableRollback ? rollbackParts.join('\n\n') : undefined,
        details,
      }),
    );
  });
};

const filterRestrictions = (rows: RestrictionInfo[], options: DatabaseCompareOptions) =>
  rows.filter((row) => {
    if (row.constraint_type === 'primary_key') return options.comparePrimaryKeys;
    if (row.constraint_type === 'unique_key') return options.compareUniqueKeys;
    if (row.constraint_type === 'check') return options.compareCheckConstraints;
    if (row.constraint_type === 'exclusion') return options.compareExclusionConstraints;
    return true;
  });

const restrictionKind = (type?: ConstraintType): DatabaseCompareKind => {
  if (type === 'primary_key') return 'primary_key';
  if (type === 'unique_key') return 'unique_key';
  if (type === 'exclusion') return 'exclusion';
  return 'check';
};

const restrictionSignature = (row: RestrictionInfo, options: DatabaseCompareOptions) => {
  const type = row.constraint_type || 'check';
  const columns = normalizeIdentifierList(row.column_names, options.ignoreColumnNameCase);

  if (type === 'primary_key' || type === 'unique_key') {
    return stableStringify({ type, columns });
  }

  return stableStringify({
    type,
    columns,
    expression: normalizeSql(row.expression || row.constraint_definition),
  });
};

const groupReferences = (rows: ReferenceInfo[]) => {
  const groups = new Map<string, ReferenceInfo[]>();

  rows.forEach((row) => {
    const key = String(row.constraint_name);
    groups.set(key, [...(groups.get(key) || []), row]);
  });

  return [...groups.values()].map((group) => {
    const ordered = [...group].sort(
      (left, right) => Number(left.constraint_order || 0) - Number(right.constraint_order || 0),
    );
    const first = ordered[0];

    return {
      ...first,
      constraint_name: String(first.constraint_name),
      column_names: ordered.map((row) => String(row.column_name)),
      reference_table_schema: first.reference_table_schema,
      reference_table_name: String(first.reference_table_name),
      reference_column_names: ordered.map((row) => String(row.reference_column_name)),
      remove_rule: first.remove_rule ? String(first.remove_rule) : undefined,
      update_rule: first.update_rule ? String(first.update_rule) : undefined,
    } satisfies ForeignKeyInfo;
  });
};

const foreignKeySignature = (row: ForeignKeyInfo, options: DatabaseCompareOptions) =>
  stableStringify({
    columns: row.column_names.map((column) => normalizeName(column, options.ignoreColumnNameCase)),
    referenceSchema: normalizeName(row.reference_table_schema, options.ignoreTableNameCase),
    referenceTable: normalizeName(row.reference_table_name, options.ignoreTableNameCase),
    referenceColumns: row.reference_column_names.map((column) =>
      normalizeName(column, options.ignoreColumnNameCase),
    ),
    removeRule: normalizeSql(row.remove_rule),
    updateRule: normalizeSql(row.update_rule),
  });

const ruleDdl = (action: string, rule: string | undefined) => {
  const normalized = normalizeSql(rule);

  if (!normalized || normalized === 'no action') return '';

  return ` ON ${action} ${String(rule).trim()}`;
};

const rawForeignKeyDefinition = (row: ForeignKeyInfo) => {
  const definition = normalizeOptional(row.constraint_definition);
  if (!definition) return '';

  const normalized = normalizeSql(definition);
  const identifiers = [...row.column_names, row.reference_table_name, ...row.reference_column_names];

  return identifiers.every((identifier) => normalized.includes(normalizeSql(identifier)))
    ? definition
    : '';
};

const foreignKeyDefinition = (quoteIdentifier: (value: string) => string, row: ForeignKeyInfo) =>
  rawForeignKeyDefinition(row) ||
  `FOREIGN KEY (${row.column_names.map(quoteIdentifier).join(', ')}) REFERENCES ${qualifiedName(
    quoteIdentifier,
    row.reference_table_schema,
    row.reference_table_name,
  )} (${row.reference_column_names.map(quoteIdentifier).join(', ')})${ruleDdl(
    'UPDATE',
    row.update_rule,
  )}${ruleDdl('DELETE', row.remove_rule)}`;

const indexSignature = (row: IndexInfo, options: DatabaseCompareOptions) =>
  stableStringify({
    method: normalizeSql(row.index_method),
    unique: Boolean(row.is_unique),
    columns: normalizeIdentifierList(row.column_names, options.ignoreColumnNameCase),
    orders: parseArray(row.column_orders).map((item) => item.toUpperCase()),
    expression: normalizeSql(row.expression),
    predicate: normalizeSql(row.predicate),
  });

const compareTableParts = (
  items: DatabaseCompareItem[],
  addItem: ReturnType<typeof makeItemFactory>,
  sourceTable: TableInfo,
  targetTable: TableInfo,
  params: {
    options: DatabaseCompareOptions;
    quoteIdentifier(value: string): string;
    ddl: CompareDdlBuilder;
  },
) => {
  const tableName = qualifiedName(
    params.quoteIdentifier,
    sourceTable.table_schema,
    sourceTable.table_name,
  );

  compareColumns(items, addItem, sourceTable, targetTable, params);

  compareNamedList({
    items,
    addItem,
    sourceRows: filterRestrictions(sourceTable.restrictions || [], params.options),
    targetRows: filterRestrictions(targetTable.restrictions || [], params.options),
    getName: (row) => restrictionSignature(row, params.options),
    getSignature: (row) => restrictionSignature(row, params.options),
    getLabelName: (row) => String(row.constraint_name),
    getKind: (row) => restrictionKind(row.constraint_type),
    createDdl: (row) => params.ddl.addConstraint(tableName, row),
    deleteDdl: (row) => params.ddl.dropConstraint(tableName, row),
    label: `${tableName}: constraint`,
    kind: 'check',
    schema: sourceTable.table_schema,
    parentName: sourceTable.table_name,
    enableRollback: params.options.enableRollback,
  });

  if (params.options.compareForeignKeys) {
    compareNamedList({
      items,
      addItem,
      sourceRows: groupReferences(sourceTable.references || []),
      targetRows: groupReferences(targetTable.references || []),
      getName: (row) => foreignKeySignature(row, params.options),
      getSignature: (row) => foreignKeySignature(row, params.options),
      getLabelName: (row) => String(row.constraint_name),
      createDdl: (row) =>
        params.ddl.addForeignKey(
          tableName,
          row,
          foreignKeyDefinition(params.quoteIdentifier, row),
        ),
      deleteDdl: (row) => params.ddl.dropForeignKey(tableName, row),
      label: `${tableName}: FK`,
      kind: 'foreign_key',
      schema: sourceTable.table_schema,
      parentName: sourceTable.table_name,
      enableRollback: params.options.enableRollback,
    });
  }

  if (params.options.compareIndexes) {
    compareNamedList({
      items,
      addItem,
      sourceRows: (sourceTable.indexes || []).filter((row) => !row.is_primary),
      targetRows: (targetTable.indexes || []).filter((row) => !row.is_primary),
      getName: (row) => indexSignature(row, params.options),
      getSignature: (row) => indexSignature(row, params.options),
      getLabelName: (row) => String(row.index_name),
      createDdl: (row) => params.ddl.createIndex(tableName, row),
      deleteDdl: (row) => params.ddl.dropIndex(tableName, sourceTable.table_schema, row),
      label: `${tableName}: índice`,
      kind: 'index',
      schema: sourceTable.table_schema,
      parentName: sourceTable.table_name,
      enableRollback: params.options.enableRollback,
    });
  }

  if (params.options.compareTriggers) {
    compareNamedList({
      items,
      addItem,
      sourceRows: sourceTable.triggers || [],
      targetRows: targetTable.triggers || [],
      getName: (row) => String(row.trigger_name),
      getSignature: (row) => stableStringify(row),
      createDdl: (row) => pushSemicolon(row.trigger_definition || ''),
      deleteDdl: (row) => params.ddl.dropTrigger(tableName, row),
      label: `${tableName}: trigger`,
      kind: 'trigger',
      schema: sourceTable.table_schema,
      parentName: sourceTable.table_name,
      enableRollback: params.options.enableRollback,
    });
  }

  if (params.options.compareRules) {
    compareNamedList({
      items,
      addItem,
      sourceRows: sourceTable.rules || [],
      targetRows: targetTable.rules || [],
      getName: (row) => String(row.rule_name),
      getSignature: (row) => normalizeSql(row.rule_definition),
      createDdl: (row) => pushSemicolon(row.rule_definition || ''),
      deleteDdl: (row) => params.ddl.dropRule(tableName, row),
      label: `${tableName}: regra`,
      kind: 'rule',
      schema: sourceTable.table_schema,
      parentName: sourceTable.table_name,
      enableRollback: params.options.enableRollback,
    });
  }

  if (
    params.options.compareOwners &&
    sourceTable.owner_name &&
    targetTable.owner_name &&
    sourceTable.owner_name !== targetTable.owner_name
  ) {
    items.push(
      addItem({
        operation: 'modify',
        kind: 'owner',
        label: `${tableName}: owner`,
        source: endpoint(sourceTable.table_schema, sourceTable.table_name),
        target: endpoint(targetTable.table_schema, targetTable.table_name),
        ddl: `ALTER TABLE ${tableName} OWNER TO ${params.quoteIdentifier(sourceTable.owner_name)};`,
        rollbackDdl: params.options.enableRollback
          ? `ALTER TABLE ${tableName} OWNER TO ${params.quoteIdentifier(targetTable.owner_name)};`
          : undefined,
        details: [`Origem: ${sourceTable.owner_name}`, `Destino: ${targetTable.owner_name}`],
      }),
    );
  }
};

const tableSignature = (table: TableInfo) =>
  stableStringify({
    objectType: table.object_type || 'table',
    definition: normalizeSql(table.definition),
    columns: (table.columns || []).map((column, index) =>
      columnSignature(column, index, { compareColumnOrder: true } as DatabaseCompareOptions),
    ),
  });

const compareTables = (
  source: Snapshot,
  target: Snapshot,
  options: DatabaseCompareOptions,
  items: DatabaseCompareItem[],
  addItem: ReturnType<typeof makeItemFactory>,
) => {
  const adapter = getDialectAdapter(target.connection.dialect);
  const ddl = getCompareDdlBuilder(target.connection.dialect, adapter.quoteIdentifier);
  const sourceOnly = [...source.tables].filter(([key]) => !target.tables.has(key));
  const targetOnly = [...target.tables].filter(([key]) => !source.tables.has(key));
  const handledSourceOnly = new Set<string>();
  const handledTargetOnly = new Set<string>();

  if (options.detectTableRenames) {
    sourceOnly.forEach(([sourceKey, sourceTable]) => {
      const sourceSignature = tableSignature(sourceTable);
      const match = targetOnly.find(
        ([targetKey, targetTable]) =>
          !handledTargetOnly.has(targetKey) && tableSignature(targetTable) === sourceSignature,
      );

      if (!match) return;

      const [targetKey, targetTable] = match;
      handledSourceOnly.add(sourceKey);
      handledTargetOnly.add(targetKey);
      const sourceName = ddl.qualifiedName(sourceTable.table_schema, sourceTable.table_name);
      const targetName = ddl.qualifiedName(targetTable.table_schema, targetTable.table_name);

      items.push(
        addItem({
          operation: 'modify',
          kind: sourceTable.object_type || 'table',
          label: `${sourceName}: renomear ${objectTypeLabel[sourceTable.object_type || 'table']}`,
          source: endpoint(sourceTable.table_schema, sourceTable.table_name),
          target: endpoint(targetTable.table_schema, targetTable.table_name),
          ddl: `ALTER TABLE ${targetName} RENAME TO ${adapter.quoteIdentifier(sourceTable.table_name)};`,
          rollbackDdl: options.enableRollback
            ? `ALTER TABLE ${sourceName} RENAME TO ${adapter.quoteIdentifier(targetTable.table_name)};`
            : undefined,
        }),
      );
    });
  }

  sourceOnly.forEach(([key, sourceTable]) => {
    if (handledSourceOnly.has(key)) return;

    const type = sourceTable.object_type || 'table';
    const name = ddl.qualifiedName(sourceTable.table_schema, sourceTable.table_name);

    items.push(
      addItem({
        operation: 'create',
        kind: type,
        label: `${objectTypeLabel[type]} ${name}`,
        source: endpoint(sourceTable.table_schema, sourceTable.table_name),
        ddl: pushSemicolon(sourceTable.definition || `-- Definição não disponível para ${name}`),
        rollbackDdl: options.enableRollback
          ? ddl.dropObject(type, sourceTable.table_schema, sourceTable.table_name, options.useCascadeDelete)
          : undefined,
      }),
    );
  });

  targetOnly.forEach(([key, targetTable]) => {
    if (handledTargetOnly.has(key)) return;

    const type = targetTable.object_type || 'table';
    const name = ddl.qualifiedName(targetTable.table_schema, targetTable.table_name);

    items.push(
      addItem({
        operation: 'delete',
        kind: type,
        label: `${objectTypeLabel[type]} ${name}`,
        target: endpoint(targetTable.table_schema, targetTable.table_name),
        ddl: ddl.dropObject(type, targetTable.table_schema, targetTable.table_name, options.useCascadeDelete),
        rollbackDdl: options.enableRollback ? pushSemicolon(targetTable.definition || '') : undefined,
      }),
    );
  });

  source.tables.forEach((sourceTable, key) => {
    const targetTable = target.tables.get(key);
    if (!targetTable) return;

    const type = sourceTable.object_type || 'table';
    const name = ddl.qualifiedName(sourceTable.table_schema, sourceTable.table_name);

    if (type === 'view' || type === 'materialized_view') {
      if (normalizeSql(sourceTable.definition) !== normalizeSql(targetTable.definition)) {
        items.push(
          addItem({
            operation: 'modify',
            kind: type,
            label: `${objectTypeLabel[type]} ${name}`,
            source: endpoint(sourceTable.table_schema, sourceTable.table_name),
            target: endpoint(targetTable.table_schema, targetTable.table_name),
            ddl: pushSemicolon(sourceTable.definition || ''),
            rollbackDdl: options.enableRollback ? pushSemicolon(targetTable.definition || '') : undefined,
            details: ['A definição do objeto difere entre origem e destino.'],
          }),
        );
      }
      return;
    }

    compareTableParts(items, addItem, sourceTable, targetTable, {
      options,
      quoteIdentifier: adapter.quoteIdentifier,
      ddl,
    });
  });
};

const compareFunctions = (
  source: Snapshot,
  target: Snapshot,
  options: DatabaseCompareOptions,
  items: DatabaseCompareItem[],
  addItem: ReturnType<typeof makeItemFactory>,
) => {
  if (!options.compareFunctions) return;

  const adapter = getDialectAdapter(target.connection.dialect);
  const ddl = getCompareDdlBuilder(target.connection.dialect, adapter.quoteIdentifier);

  compareNamedList({
    items,
    addItem,
    sourceRows: [...source.functions.values()],
    targetRows: [...target.functions.values()],
    getName: (row) =>
      `${row.function_schema ? `${row.function_schema}.` : ''}${row.function_name}(${
        row.function_identity_arguments || ''
      })`,
    getSignature: (row) =>
      stableStringify({
        definition: normalizeSql(row.definition),
        owner: options.compareOwners ? row.owner_name : undefined,
      }),
    createDdl: (row) => pushSemicolon(row.definition || ''),
    deleteDdl: (row) =>
      ddl.dropFunction(
        row.function_schema,
        row.function_name,
        row.function_identity_arguments,
        options.useCascadeDelete,
      ),
    label: 'função',
    kind: 'function',
    enableRollback: options.enableRollback,
  });
};

const compareSequences = (
  source: Snapshot,
  target: Snapshot,
  options: DatabaseCompareOptions,
  items: DatabaseCompareItem[],
  addItem: ReturnType<typeof makeItemFactory>,
) => {
  if (!options.compareSequences) return;

  const adapter = getDialectAdapter(target.connection.dialect);
  const ddl = getCompareDdlBuilder(target.connection.dialect, adapter.quoteIdentifier);

  compareNamedList({
    items,
    addItem,
    sourceRows: [...source.sequences.values()],
    targetRows: [...target.sequences.values()],
    getName: (row) => `${row.sequence_schema ? `${row.sequence_schema}.` : ''}${row.sequence_name}`,
    getSignature: (row) =>
      stableStringify({
        definition: normalizeSql(row.sequence_definition),
        owner: options.compareOwners ? row.owner_name : undefined,
        lastValue: options.compareSequenceLastValues ? row.last_value : undefined,
      }),
    createDdl: (row) =>
      pushSemicolon(
        row.sequence_definition ||
          `CREATE SEQUENCE ${ddl.qualifiedName(row.sequence_schema, row.sequence_name)}`,
      ),
    deleteDdl: (row) =>
      ddl.dropSequence(row.sequence_schema, row.sequence_name, options.useCascadeDelete),
    label: 'sequência',
    kind: 'sequence',
    enableRollback: options.enableRollback,
  });
};

export const compareDatabases = async (
  params: DatabaseCompareParams,
  getConnection: ConnectionGetter,
): Promise<DatabaseCompareResult> => {
  const addItem = makeItemFactory();
  const warnings: string[] = [];
  const [source, target] = await Promise.all([
    getSnapshot(params.sourceConnectionId, params.selectedObjects, params.options, getConnection),
    getSnapshot(params.targetConnectionId, params.selectedObjects, params.options, getConnection),
  ]);

  if (source.connection.dialect !== target.connection.dialect) {
    warnings.push('Origem e destino usam dialetos diferentes. A comparação pode exigir revisão manual.');
  }

  const items: DatabaseCompareItem[] = [];

  compareTables(source, target, params.options, items, addItem);
  compareFunctions(source, target, params.options, items, addItem);
  compareSequences(source, target, params.options, items, addItem);

  const summary: Record<DatabaseCompareOperation, number> = {
    create: 0,
    modify: 0,
    delete: 0,
    none: 0,
  };

  items.forEach((item) => {
    summary[item.operation] += 1;
  });

  if (!items.length) {
    summary.none = 1;
    items.push(
      addItem({
        operation: 'none',
        kind: 'table',
        label: 'Nenhuma diferença encontrada',
        details: ['Os objetos selecionados estão equivalentes para as opções marcadas.'],
      }),
    );
  }

  return { items, warnings, summary };
};
