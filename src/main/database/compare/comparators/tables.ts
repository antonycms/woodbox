import type { ConstraintType } from '@shared/types/database';
import type {
  DatabaseCompareItem,
  DatabaseCompareKind,
  DatabaseCompareMessage,
  DatabaseCompareOptions,
} from '@shared/types/databaseCompare';
import { getCompareDdlBuilder, type CompareDdlBuilder, type CompareColumnChanges } from '../../compareDdl';
import { getDialectAdapter } from '../../dialects';
import type {
  ColumnInfo,
  ForeignKeyInfo,
  IndexInfo,
  ReferenceInfo,
  RestrictionInfo,
  Snapshot,
  TableInfo,
} from '../types';
import {
  compareNamedList,
  display,
  endpoint,
  normalizeIdentifierList,
  normalizeName,
  normalizeOptional,
  normalizeSql,
  parseArray,
  pushSemicolon,
  qualifiedName,
  stableStringify,
  type CompareItemFactory,
} from '../utils';

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

const compareColumns = (
  items: DatabaseCompareItem[],
  addItem: CompareItemFactory,
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
          display: display(
            sourceTable.table_schema,
            source.column.column_name,
            sourceTable.table_name,
            target.column.column_name,
          ),
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
        display: display(sourceTable.table_schema, source.column.column_name, sourceTable.table_name),
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
        display: display(targetTable.table_schema, target.column.column_name, targetTable.table_name),
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

    const details: DatabaseCompareMessage[] = [];
    const typeChanged = columnTypeSignature(source.column) !== columnTypeSignature(target.column);
    const nullableChanged = Boolean(source.column.is_nullable) !== Boolean(target.column.is_nullable);
    const defaultChanged = columnDefaultSignature(source.column) !== columnDefaultSignature(target.column);
    const changes: CompareColumnChanges = { typeChanged, nullableChanged, defaultChanged };

    if (typeChanged) {
      details.push({ code: 'column_type_changed' });
    }

    if (nullableChanged) {
      details.push({ code: 'column_nullable_changed' });
    }

    if (defaultChanged) {
      details.push({ code: 'column_default_changed' });
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
        display: display(sourceTable.table_schema, source.column.column_name, sourceTable.table_name),
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
  addItem: CompareItemFactory,
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
    getDisplay: (row) => display(sourceTable.table_schema, String(row.constraint_name), sourceTable.table_name),
    getKind: (row) => restrictionKind(row.constraint_type),
    createDdl: (row) => params.ddl.addConstraint(tableName, row),
    deleteDdl: (row) => params.ddl.dropConstraint(tableName, row),
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
      getDisplay: (row) => display(sourceTable.table_schema, String(row.constraint_name), sourceTable.table_name),
      createDdl: (row) =>
        params.ddl.addForeignKey(
          tableName,
          row,
          foreignKeyDefinition(params.quoteIdentifier, row),
        ),
      deleteDdl: (row) => params.ddl.dropForeignKey(tableName, row),
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
      getDisplay: (row) => display(sourceTable.table_schema, String(row.index_name), sourceTable.table_name),
      createDdl: (row) => params.ddl.createIndex(tableName, row),
      deleteDdl: (row) => params.ddl.dropIndex(tableName, sourceTable.table_schema, row),
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
      getDisplay: (row) => display(sourceTable.table_schema, String(row.trigger_name), sourceTable.table_name),
      createDdl: (row) => pushSemicolon(row.trigger_definition || ''),
      deleteDdl: (row) => params.ddl.dropTrigger(tableName, row),
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
      getDisplay: (row) => display(sourceTable.table_schema, String(row.rule_name), sourceTable.table_name),
      createDdl: (row) => pushSemicolon(row.rule_definition || ''),
      deleteDdl: (row) => params.ddl.dropRule(tableName, row),
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
        display: display(sourceTable.table_schema, sourceTable.table_name),
        source: endpoint(sourceTable.table_schema, sourceTable.table_name),
        target: endpoint(targetTable.table_schema, targetTable.table_name),
        ddl: `ALTER TABLE ${tableName} OWNER TO ${params.quoteIdentifier(sourceTable.owner_name)};`,
        rollbackDdl: params.options.enableRollback
          ? `ALTER TABLE ${tableName} OWNER TO ${params.quoteIdentifier(targetTable.owner_name)};`
          : undefined,
        details: [
          {
            code: 'owner_changed',
            values: { source: sourceTable.owner_name, target: targetTable.owner_name },
          },
        ],
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

export const compareTables = (
  source: Snapshot,
  target: Snapshot,
  options: DatabaseCompareOptions,
  items: DatabaseCompareItem[],
  addItem: CompareItemFactory,
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
          display: display(
            sourceTable.table_schema,
            sourceTable.table_name,
            undefined,
            targetTable.table_name,
          ),
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
        display: display(sourceTable.table_schema, sourceTable.table_name),
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

    items.push(
      addItem({
        operation: 'delete',
        kind: type,
        display: display(targetTable.table_schema, targetTable.table_name),
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

    if (type === 'view' || type === 'materialized_view') {
      if (normalizeSql(sourceTable.definition) !== normalizeSql(targetTable.definition)) {
        items.push(
          addItem({
            operation: 'modify',
            kind: type,
            display: display(sourceTable.table_schema, sourceTable.table_name),
            source: endpoint(sourceTable.table_schema, sourceTable.table_name),
            target: endpoint(targetTable.table_schema, targetTable.table_name),
            ddl: pushSemicolon(sourceTable.definition || ''),
            rollbackDdl: options.enableRollback ? pushSemicolon(targetTable.definition || '') : undefined,
            details: [{ code: 'object_definition_changed' }],
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

