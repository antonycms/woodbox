import type { RendererDialect } from '@renderer/database/dialects';
import type { RendererDialectDdlHelpers } from '@renderer/database/dialects/types';
import type {
  IColumnInfo,
  IColumnReferenceInfo,
  IColumnRestrictionsInfo,
  IIndexInfo,
  ITriggerInfo,
} from '@renderer/contexts/Store';
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
} from '@renderer/contexts/TableInfoContext';

export const quoteLiteral = (value: string) => `'${String(value).replace(/'/g, "''")}'`;

const serializeInsertValue = (value: any) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return quoteLiteral(value.toISOString());
  if (typeof value === 'object') return quoteLiteral(JSON.stringify(value));

  return quoteLiteral(String(value));
};

const getInsertColumns = (row: Record<string, any>, columnOrder?: string[]) => {
  const rowColumns = Object.keys(row);

  if (!columnOrder?.length) return rowColumns;

  const orderedColumns = columnOrder.filter((column) => rowColumns.includes(column));
  const extraColumns = rowColumns.filter((column) => !orderedColumns.includes(column));

  return [...orderedColumns, ...extraColumns];
};

const getInsertGroupKey = (columns: string[]) => columns.join('\0');

const getTableName = (dialect: RendererDialect, schema: string | undefined, table: string) => {
  return dialect.getQualifiedName(schema, table);
};

const normalizeOptionalString = (value?: string) => {
  const trimmedValue = value?.trim();

  return trimmedValue || undefined;
};

const getColumnType = (column: IColumnInfo) => {
  if (column.character_maximum_length) {
    return `${column.data_type}(${column.character_maximum_length})`;
  }

  if (column.numeric_precision) {
    return column.numeric_scale !== undefined && column.numeric_scale !== null
      ? `${column.data_type}(${column.numeric_precision},${column.numeric_scale})`
      : `${column.data_type}(${column.numeric_precision})`;
  }

  if (column.datetime_precision !== undefined && column.datetime_precision !== null) {
    return `${column.data_type}(${column.datetime_precision})`;
  }

  if (column.data_type === 'USER-DEFINED' && column.udt_name) {
    return column.udt_name;
  }

  return column.data_type;
};

const getDdlHelpers = (dialect: RendererDialect): RendererDialectDdlHelpers => ({
  quoteIdent: dialect.quoteIdent,
  quoteLiteral,
  getColumnType,
  getTableName: (schema, table) => getTableName(dialect, schema, table),
  normalizeOptionalString,
});

export const generateInsertDdl = (
  dialect: RendererDialect,
  schema: string | undefined,
  table: string,
  rows: Record<string, any>[],
  columnOrder?: string[],
) => {
  if (!rows.length) return '';

  const quoteIdent = dialect.quoteIdent;
  const tableName = getTableName(dialect, schema, table);
  const groups = new Map<string, { columns: string[]; rows: Record<string, any>[] }>();

  rows.forEach((row) => {
    const columns = getInsertColumns(row, columnOrder);
    if (!columns.length) return;

    const key = getInsertGroupKey(columns);
    const group = groups.get(key);

    if (group) {
      group.rows.push(row);
      return;
    }

    groups.set(key, { columns, rows: [row] });
  });

  return [...groups.values()]
    .map(({ columns, rows: groupRows }) => {
      const columnsSql = columns.map(quoteIdent).join(', ');
      const valuesSql = groupRows
        .map(
          (row) => `  (${columns.map((column) => serializeInsertValue(row[column])).join(', ')})`,
        )
        .join(',\n');

      return `INSERT INTO ${tableName} (${columnsSql})\nVALUES\n${valuesSql};`;
    })
    .join('\n\n');
};

const serializeUpdateValue = serializeInsertValue;

const serializeWhereValue = (dialect: RendererDialect, column: string, value: any) => {
  const quoteIdent = dialect.quoteIdent;

  if (value === null || value === undefined) return `${quoteIdent(column)} IS NULL`;

  return `${quoteIdent(column)} = ${serializeUpdateValue(value)}`;
};

export const generateUpdateDdl = (
  dialect: RendererDialect,
  schema: string | undefined,
  table: string,
  rows: Array<{
    originalRow: Record<string, any>;
    changes: Record<string, any>;
  }>,
  whereColumns: string[],
) => {
  const quoteIdent = dialect.quoteIdent;
  const tableName = getTableName(dialect, schema, table);

  return rows
    .map(({ originalRow, changes }) => {
      const setSql = Object.entries(changes)
        .map(([column, value]) => `  ${quoteIdent(column)} = ${serializeUpdateValue(value)}`)
        .join(',\n');

      const whereSql = whereColumns
        .map((column) => serializeWhereValue(dialect, column, originalRow[column]))
        .join('\n  AND ');

      if (!setSql || !whereSql) return null;

      return `UPDATE ${tableName}\nSET\n${setSql}\nWHERE ${whereSql};`;
    })
    .filter((sql): sql is string => !!sql)
    .join('\n\n')
    .trim();
};

export const generateDeleteDdl = (
  dialect: RendererDialect,
  schema: string | undefined,
  table: string,
  rows: Record<string, any>[],
  whereColumns: string[],
) => {
  const tableName = getTableName(dialect, schema, table);

  return rows
    .map((row) => {
      const whereSql = whereColumns
        .map((column) => serializeWhereValue(dialect, column, row[column]))
        .join('\n  AND ');

      if (!whereSql) return null;

      return `DELETE FROM ${tableName}\nWHERE ${whereSql};`;
    })
    .filter((sql): sql is string => !!sql)
    .join('\n\n');
};

const groupByConstraintName = (references: IColumnReferenceInfo[] = []) => {
  return references.reduce<Record<string, IColumnReferenceInfo[]>>((groups, reference) => {
    const group = groups[reference.constraint_name] || [];

    return { ...groups, [reference.constraint_name]: [...group, reference] };
  }, {});
};

const getConstraintColumns = (references: IColumnReferenceInfo[]) => {
  return [...references]
    .sort((a, b) => (a.constraint_order || 0) - (b.constraint_order || 0))
    .map((reference) => reference.column_name);
};

const hasAllColumnsSelected = (constraintColumns: string[], selectedColumns: Set<string>) => {
  return (
    !!constraintColumns.length && constraintColumns.every((column) => selectedColumns.has(column))
  );
};

const getReferencesDdlBySelectedColumns = (
  dialect: RendererDialect,
  tableName: string,
  selectedColumnNames: Set<string>,
  references: IColumnReferenceInfo[] = [],
) => {
  const helpers = getDdlHelpers(dialect);

  return Object.values(groupByConstraintName(references))
    .map((group) => {
      const constraintColumns = getConstraintColumns(group);
      const [reference] = group;

      if (!hasAllColumnsSelected(constraintColumns, selectedColumnNames)) return null;
      if (!reference.constraint_definition) return null;

      return dialect.ddl.getCreateConstraintFromDefinitionDdl(
        tableName,
        reference.constraint_name,
        reference.constraint_definition,
        reference.comment,
        helpers,
      );
    })
    .filter((ddl): ddl is string => !!ddl);
};

const getRestrictionsDdlBySelectedColumns = (
  dialect: RendererDialect,
  tableName: string,
  selectedColumnNames: Set<string>,
  restrictions: IColumnRestrictionsInfo[] = [],
) => {
  const helpers = getDdlHelpers(dialect);

  return restrictions
    .map((restriction) => {
      const constraintColumns = restriction.column_names || [];

      if (!hasAllColumnsSelected(constraintColumns, selectedColumnNames)) return null;
      if (!restriction.constraint_definition) return null;

      return dialect.ddl.getCreateConstraintFromDefinitionDdl(
        tableName,
        restriction.constraint_name,
        restriction.constraint_definition,
        restriction.comment,
        helpers,
      );
    })
    .filter((ddl): ddl is string => !!ddl);
};

export const generateReferencesDdl = (
  dialect: RendererDialect,
  schema: string | undefined,
  table: string,
  references: IColumnReferenceInfo[],
) => {
  const tableName = getTableName(dialect, schema, table);
  const helpers = getDdlHelpers(dialect);
  const constraints = new Map<string, IColumnReferenceInfo>();

  references.forEach((reference) => {
    if (!constraints.has(reference.constraint_name)) {
      constraints.set(reference.constraint_name, reference);
    }
  });

  return [...constraints.values()]
    .map((reference) => {
      if (!reference.constraint_definition) return null;

      return dialect.ddl.getCreateConstraintFromDefinitionDdl(
        tableName,
        reference.constraint_name,
        reference.constraint_definition,
        reference.comment,
        helpers,
      );
    })
    .filter((ddl): ddl is string => !!ddl)
    .join('\n\n');
};

export const generateRestrictionsDdl = (
  dialect: RendererDialect,
  schema: string | undefined,
  table: string,
  restrictions: IColumnRestrictionsInfo[],
) => {
  const tableName = getTableName(dialect, schema, table);
  const helpers = getDdlHelpers(dialect);

  return restrictions
    .map((restriction) => {
      if (!restriction.constraint_definition) return null;

      return dialect.ddl.getCreateConstraintFromDefinitionDdl(
        tableName,
        restriction.constraint_name,
        restriction.constraint_definition,
        restriction.comment,
        helpers,
      );
    })
    .filter((ddl): ddl is string => !!ddl)
    .join('\n\n');
};

export const generateTriggersDdl = (triggers: ITriggerInfo[]) => {
  return triggers
    .map((trigger) => trigger.trigger_definition)
    .filter((definition): definition is string => !!definition)
    .map((definition) => (definition.endsWith(';') ? definition : `${definition};`))
    .join('\n\n');
};

export const generateIndexesDdl = (indexes: IIndexInfo[]) => {
  return indexes
    .map((index) => index.index_definition)
    .filter((definition): definition is string => !!definition)
    .map((definition) => (definition.endsWith(';') ? definition : `${definition};`))
    .join('\n\n');
};

const isAutoIncrementColumnRestriction = (
  columns: IColumnInfo[],
  restriction: IColumnRestrictionsInfo,
) => {
  if (!['primary_key', 'unique_key'].includes(restriction.constraint_type || '')) return false;
  if (restriction.column_names?.length !== 1) return false;

  return columns.some(
    (column) => column.is_auto_increment && column.column_name === restriction.column_names?.[0],
  );
};

const getRestrictionsWithoutAutoIncrementColumnConstraint = <T extends IColumnRestrictionsInfo>(
  columns: IColumnInfo[],
  restrictions: T[] = [],
) => {
  return restrictions.filter(
    (restriction) => !isAutoIncrementColumnRestriction(columns, restriction),
  );
};

export const generateAddColumnsDdl = (
  dialect: RendererDialect,
  schema: string | undefined,
  table: string,
  columns: IColumnInfo[],
  options?: {
    references?: IColumnReferenceInfo[];
    restrictions?: IColumnRestrictionsInfo[];
  },
) => {
  if (!columns?.length) return '';

  const helpers = getDdlHelpers(dialect);
  const tableName = getTableName(dialect, schema, table);
  const selectedColumnNames = new Set(columns.map((column) => column.column_name));
  const restrictions = options?.restrictions || [];
  const restrictionsToCreate = getRestrictionsWithoutAutoIncrementColumnConstraint(
    columns,
    restrictions,
  );

  return [
    ...columns.flatMap((column) =>
      dialect.ddl.getAddColumnDdl(tableName, column, helpers, restrictions),
    ),
    ...getRestrictionsDdlBySelectedColumns(
      dialect,
      tableName,
      selectedColumnNames,
      restrictionsToCreate,
    ),
    ...getReferencesDdlBySelectedColumns(
      dialect,
      tableName,
      selectedColumnNames,
      options?.references,
    ),
  ]
    .filter(Boolean)
    .join('\n\n');
};

const getDropConstraintsDdl = (
  dialect: RendererDialect,
  tableName: string,
  droppedColumnNames: Set<string>,
  options: {
    restrictions?: IColumnRestrictionsInfo[];
    references?: IColumnReferenceInfo[];
  },
) => {
  const helpers = getDdlHelpers(dialect);
  const constraintsToDrop = new Map<string, IColumnRestrictionsInfo | IColumnReferenceInfo>();

  options.restrictions?.forEach((restriction) => {
    const hasDroppedColumn = restriction.column_names?.some((columnName) =>
      droppedColumnNames.has(columnName),
    );

    if (hasDroppedColumn) constraintsToDrop.set(restriction.constraint_name, restriction);
  });

  options.references?.forEach((reference) => {
    if (droppedColumnNames.has(reference.column_name)) {
      constraintsToDrop.set(reference.constraint_name, reference);
    }
  });

  return [...constraintsToDrop.values()]
    .map((constraint) => dialect.ddl.getDropConstraintDdl(tableName, constraint, helpers))
    .filter(Boolean);
};

const getDropAutoIncrementDdl = (
  dialect: RendererDialect,
  tableName: string,
  columns: IColumnInfo[] = [],
) => {
  const helpers = getDdlHelpers(dialect);

  if (!dialect.ddl.getDropAutoIncrementDdl) return [];

  return columns
    .filter((column) => column.is_auto_increment)
    .map((column) => dialect.ddl.getDropAutoIncrementDdl?.(tableName, column, helpers))
    .filter((ddl): ddl is string => !!ddl);
};

const getDropPendingRestrictionsDdl = (
  dialect: RendererDialect,
  tableName: string,
  restrictions: IPendingRestrictionDrop[] = [],
) => {
  const helpers = getDdlHelpers(dialect);
  const constraints = new Map<string, IPendingRestrictionDrop>();

  restrictions.forEach((restriction) => constraints.set(restriction.constraint_name, restriction));

  return [...constraints.values()]
    .map((constraint) => dialect.ddl.getDropConstraintDdl(tableName, constraint, helpers))
    .filter(Boolean);
};

const getDropPendingReferencesDdl = (
  dialect: RendererDialect,
  tableName: string,
  references: IPendingReferenceDrop[] = [],
) => {
  const helpers = getDdlHelpers(dialect);
  const constraints = new Map<string, IPendingReferenceDrop>();

  references.forEach((reference) => constraints.set(reference.constraint_name, reference));

  return [...constraints.values()]
    .map((constraint) => dialect.ddl.getDropConstraintDdl(tableName, constraint, helpers))
    .filter(Boolean);
};

const getDropPendingIndexesDdl = (
  dialect: RendererDialect,
  schema: string | undefined,
  table: string,
  indexes: IPendingIndexDrop[] = [],
) => {
  const helpers = getDdlHelpers(dialect);
  const indexNames = [...new Set(indexes.map((index) => index.index_name))];

  return indexNames
    .map((indexName) => dialect.ddl.getDropIndexDdl(schema, table, indexName, helpers))
    .filter(Boolean);
};

const getCreateRestrictionsDdl = (
  dialect: RendererDialect,
  tableName: string,
  restrictions: IPendingRestrictionCreate[] = [],
) => {
  const helpers = getDdlHelpers(dialect);

  return restrictions.map((restriction) =>
    dialect.ddl.getCreateRestrictionDdl(tableName, restriction, helpers),
  );
};

const getCreateIndexesDdl = (
  dialect: RendererDialect,
  schema: string | undefined,
  table: string,
  indexes: IPendingIndexCreate[] = [],
  availableColumns: IColumnInfo[] = [],
) => {
  const helpers = getDdlHelpers(dialect);
  const columnsByName = new Map(availableColumns.map((column) => [column.column_name, column]));

  return indexes.map((index) =>
    dialect.ddl.getCreateIndexDdl(
      schema,
      table,
      {
        ...index,
        columns: (index.column_names || [])
          .map((columnName) => columnsByName.get(columnName))
          .filter((column): column is IColumnInfo => !!column),
      },
      helpers,
    ),
  );
};

const getCreateReferencesDdl = (
  dialect: RendererDialect,
  tableName: string,
  references: IPendingReferenceCreate[] = [],
) => {
  const helpers = getDdlHelpers(dialect);

  return references.map((reference) =>
    dialect.ddl.getCreateReferenceDdl(tableName, reference, helpers),
  );
};

const getChangeColumnDdl = (
  dialect: RendererDialect,
  tableName: string,
  column: IPendingColumnChange,
) => {
  return dialect.ddl.getChangeColumnDdl(tableName, column, getDdlHelpers(dialect));
};

export const generateCreateTableDdl = (
  dialect: RendererDialect,
  schema: string | undefined,
  table: string,
  changes: {
    columns: IPendingColumnCreate[];
    indexes?: IPendingIndexCreate[];
    restrictions?: IPendingRestrictionCreate[];
    references?: IPendingReferenceCreate[];
    tableComment?: string;
  },
) => {
  const columns = changes.columns || [];
  const indexes = changes.indexes || [];
  const restrictions = changes.restrictions || [];
  const references = changes.references || [];
  const helpers = getDdlHelpers(dialect);
  const tableName = getTableName(dialect, schema, table);

  const createTable = dialect.ddl.getCreateTableDdl(tableName, columns, restrictions, helpers);
  const tableComment = dialect.ddl.getTableCommentDdl(tableName, changes.tableComment, helpers);
  const columnComments = columns
    .map((column) =>
      dialect.ddl.getColumnCommentDdl(tableName, column.column_name, column.description, helpers),
    )
    .filter(Boolean);

  return [
    createTable,
    tableComment,
    ...columnComments,
    ...dialect.ddl.getPostCreateTableRestrictionsDdl(tableName, restrictions, helpers),
    ...getCreateIndexesDdl(dialect, schema, table, indexes, columns),
    ...getCreateReferencesDdl(dialect, tableName, references),
  ]
    .filter(Boolean)
    .join('\n\n');
};

export const generatePendingTableChangesDdl = (
  dialect: RendererDialect,
  schema: string | undefined,
  table: string,
  changes: {
    columns: IPendingColumnCreate[];
    droppedColumns?: IPendingColumnDrop[];
    changedColumns?: IPendingColumnChange[];
    indexes?: IPendingIndexCreate[];
    droppedIndexes?: IPendingIndexDrop[];
    restrictions?: IPendingRestrictionCreate[];
    droppedRestrictions?: IPendingRestrictionDrop[];
    references?: IPendingReferenceCreate[];
    droppedReferences?: IPendingReferenceDrop[];
    existingRestrictions?: IColumnRestrictionsInfo[];
    existingReferences?: IColumnReferenceInfo[];
    existingColumns?: IColumnInfo[];
  },
) => {
  const columns = changes.columns || [];
  const droppedColumns = changes.droppedColumns || [];
  const changedColumns = changes.changedColumns || [];
  const indexes = changes.indexes || [];
  const droppedIndexes = changes.droppedIndexes || [];
  const restrictions = changes.restrictions || [];
  const droppedRestrictions = changes.droppedRestrictions || [];
  const references = changes.references || [];
  const droppedReferences = changes.droppedReferences || [];

  if (
    !columns.length &&
    !droppedColumns.length &&
    !changedColumns.length &&
    !indexes.length &&
    !droppedIndexes.length &&
    !restrictions.length &&
    !droppedRestrictions.length &&
    !references.length &&
    !droppedReferences.length
  ) {
    return '';
  }

  const helpers = getDdlHelpers(dialect);
  const tableName = getTableName(dialect, schema, table);
  const droppedColumnNames = new Set(droppedColumns.map((column) => column.column_name));
  const changedColumnsByOriginalName = new Map(
    changedColumns.map((column) => [column.__originalColumn.column_name, column]),
  );
  const availableColumns = [
    ...(changes.existingColumns || [])
      .filter((column) => !droppedColumnNames.has(column.column_name))
      .map((column) => changedColumnsByOriginalName.get(column.column_name) || column),
    ...columns,
  ];
  const dropColumnStatements = droppedColumns.map((column) =>
    dialect.ddl.getDropColumnDdl(tableName, column.column_name, helpers),
  );
  const changeColumnStatements = changedColumns.flatMap((column) =>
    getChangeColumnDdl(dialect, tableName, column),
  );
  const postCreateRestrictionChangeColumnStatements = changedColumns.flatMap((column) =>
    dialect.ddl.getPostCreateRestrictionChangeColumnDdl(tableName, column, helpers),
  );
  const createColumnStatements = columns.flatMap((column) =>
    dialect.ddl.getAddColumnDdl(tableName, column, helpers, restrictions),
  );
  const restrictionsToCreate = getRestrictionsWithoutAutoIncrementColumnConstraint(
    columns,
    restrictions,
  );
  const postCreateRestrictionAddColumnStatements = columns.flatMap((column) =>
    dialect.ddl.getPostCreateRestrictionAddColumnDdl(tableName, column, helpers),
  );

  return [
    ...getDropAutoIncrementDdl(dialect, tableName, droppedColumns),
    ...getDropConstraintsDdl(dialect, tableName, droppedColumnNames, {
      restrictions: changes.existingRestrictions,
      references: changes.existingReferences,
    }),
    ...getDropPendingRestrictionsDdl(dialect, tableName, droppedRestrictions),
    ...getDropPendingReferencesDdl(dialect, tableName, droppedReferences),
    ...getDropPendingIndexesDdl(dialect, schema, table, droppedIndexes),
    ...dropColumnStatements,
    ...changeColumnStatements,
    ...createColumnStatements,
    ...getCreateRestrictionsDdl(dialect, tableName, restrictionsToCreate),
    ...postCreateRestrictionAddColumnStatements,
    ...postCreateRestrictionChangeColumnStatements,
    ...getCreateIndexesDdl(dialect, schema, table, indexes, availableColumns),
    ...getCreateReferencesDdl(dialect, tableName, references),
  ]
    .filter(Boolean)
    .join('\n\n');
};
