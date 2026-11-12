import type { StructureColumn, StructureReference, StructureRestriction, StructureIndex } from '@shared/types/databaseDdl';
import type { StructureDialect, StructureDialectDdlHelpers, StructureColumnChange } from './types';
import { quoteLiteral } from './syntax';

const getTableName = (dialect: StructureDialect, schema: string | undefined, table: string) => {
  return dialect.getQualifiedName(schema, table);
};

const normalizeOptionalString = (value?: string) => {
  const trimmedValue = value?.trim();

  return trimmedValue || undefined;
};

export const getColumnType = (column: StructureColumn) => {
  if (column.character_maximum_length) {
    return `${column.data_type}(${column.character_maximum_length})`;
  }

  if (column.numeric_precision && column.numeric_scale) {
    return `${column.data_type}(${column.numeric_precision},${column.numeric_scale})`;
  }

  if (column.data_type === 'USER-DEFINED' && column.udt_name) {
    return column.udt_name;
  }

  return column.data_type;
};

export const getDdlHelpers = (dialect: StructureDialect, restrictions: StructureRestriction[] = []): StructureDialectDdlHelpers => {
  const autoKeys = new Map<string, StructureRestriction>();
  for (const restriction of restrictions) {
    if (['primary_key', 'unique_key'].includes(restriction.constraint_type) && restriction.column_names?.length === 1 && !autoKeys.has(restriction.column_names[0])) autoKeys.set(restriction.column_names[0], restriction);
  }
  const helpers: StructureDialectDdlHelpers = {
    quoteIdent: dialect.quoteIdent,
    getAutoIncrementRestriction: name => autoKeys.get(name),
    quoteLiteral,
    getColumnType: (column) =>
      dialect.ddl.getColumnTypeDdl?.(column, helpers) || getColumnType(column),
    getDefaultColumnType: getColumnType,
    getTableName: (schema, table) => getTableName(dialect, schema, table),
    normalizeOptionalString,
  };

  return helpers;
};

const groupByConstraintName = (references: StructureReference[] = []) => {
  const groups: Record<string, StructureReference[]> = Object.create(null);
  for (const reference of references) (groups[reference.constraint_name] ||= []).push(reference);
  return groups;
};

const getConstraintColumns = (references: StructureReference[]) => {
  return references.map((reference) => reference.column_name);
};

const hasAllColumnsSelected = (constraintColumns: string[], selectedColumns: Set<string>) => {
  return (
    !!constraintColumns.length && constraintColumns.every((column) => selectedColumns.has(column))
  );
};

const getReferencesDdlBySelectedColumns = (
  dialect: StructureDialect,
  tableName: string,
  selectedColumnNames: Set<string>,
  references: StructureReference[] = [],
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
  dialect: StructureDialect,
  tableName: string,
  selectedColumnNames: Set<string>,
  restrictions: StructureRestriction[] = [],
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
  dialect: StructureDialect,
  schema: string | undefined,
  table: string,
  references: StructureReference[],
) => {
  const tableName = getTableName(dialect, schema, table);
  const helpers = getDdlHelpers(dialect);
  const constraints = new Map<string, StructureReference>();

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
  dialect: StructureDialect,
  schema: string | undefined,
  table: string,
  restrictions: StructureRestriction[],
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

const getRestrictionsWithoutAutoIncrementColumnConstraint = <T extends StructureRestriction>(
  columns: StructureColumn[], restrictions: T[] = [],
) => {
  const auto = new Set(columns.filter((column) => column.is_auto_increment).map((column) => column.column_name));
  return restrictions.filter((restriction) => !(
    ['primary_key', 'unique_key'].includes(restriction.constraint_type || '') &&
    restriction.column_names?.length === 1 && auto.has(restriction.column_names[0])
  ));
};

export const generateAddColumnsDdl = (
  dialect: StructureDialect,
  schema: string | undefined,
  table: string,
  columns: StructureColumn[],
  options?: {
    references?: StructureReference[];
    restrictions?: StructureRestriction[];
  },
) => {
  if (!columns?.length) return '';

  const helpers = getDdlHelpers(dialect, options?.restrictions);
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
  dialect: StructureDialect,
  tableName: string,
  droppedColumnNames: Set<string>,
  options: {
    restrictions?: StructureRestriction[];
    references?: StructureReference[];
  },
) => {
  const helpers = getDdlHelpers(dialect);
  const constraintsToDrop = new Map<string, StructureRestriction | StructureReference>();

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
  dialect: StructureDialect,
  tableName: string,
  columns: StructureColumn[] = [],
) => {
  const helpers = getDdlHelpers(dialect);

  if (!dialect.ddl.getDropAutoIncrementDdl) return [];

  return columns
    .filter((column) => column.is_auto_increment)
    .map((column) => dialect.ddl.getDropAutoIncrementDdl?.(tableName, column, helpers))
    .filter((ddl): ddl is string => !!ddl);
};

const getDropPendingRestrictionsDdl = (
  dialect: StructureDialect,
  tableName: string,
  restrictions: StructureRestriction[] = [],
) => {
  const helpers = getDdlHelpers(dialect);
  const constraints = new Map<string, StructureRestriction>();

  restrictions.forEach((restriction) => constraints.set(restriction.constraint_name, restriction));

  return [...constraints.values()]
    .map((constraint) => dialect.ddl.getDropConstraintDdl(tableName, constraint, helpers))
    .filter(Boolean);
};

const getDropPendingReferencesDdl = (
  dialect: StructureDialect,
  tableName: string,
  references: StructureReference[] = [],
) => {
  const helpers = getDdlHelpers(dialect);
  const constraints = new Map<string, StructureReference>();

  references.forEach((reference) => constraints.set(reference.constraint_name, reference));

  return [...constraints.values()]
    .map((constraint) => dialect.ddl.getDropConstraintDdl(tableName, constraint, helpers))
    .filter(Boolean);
};

const getDropPendingIndexesDdl = (
  dialect: StructureDialect,
  schema: string | undefined,
  table: string,
  indexes: StructureIndex[] = [],
) => {
  const helpers = getDdlHelpers(dialect);
  const indexNames = [...new Set(indexes.map((index) => index.index_name))];

  return indexNames
    .map((indexName) => dialect.ddl.getDropIndexDdl(schema, table, indexName, helpers))
    .filter(Boolean);
};

const getCreateRestrictionsDdl = (
  dialect: StructureDialect,
  tableName: string,
  restrictions: StructureRestriction[] = [],
) => {
  const helpers = getDdlHelpers(dialect);

  return restrictions.map((restriction) =>
    dialect.ddl.getCreateRestrictionDdl(tableName, restriction, helpers),
  );
};

const getCreateIndexesDdl = (
  dialect: StructureDialect,
  schema: string | undefined,
  table: string,
  indexes: StructureIndex[] = [],
  availableColumns: StructureColumn[] = [],
) => {
  if (!indexes.length) return [];
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
          .filter((column): column is StructureColumn => !!column),
      },
      helpers,
    ),
  );
};

const getCreateReferencesDdl = (
  dialect: StructureDialect,
  tableName: string,
  references: StructureReference[] = [],
) => {
  const helpers = getDdlHelpers(dialect);

  return references.map((reference) =>
    dialect.ddl.getCreateReferenceDdl(tableName, reference, helpers),
  );
};

const getChangeColumnDdl = (
  dialect: StructureDialect,
  tableName: string,
  column: StructureColumnChange,
) => {
  return dialect.ddl.getChangeColumnDdl(tableName, column, getDdlHelpers(dialect));
};

const generateRenameTableDdl = (
  dialect: StructureDialect,
  schema: string | undefined,
  table: string,
  newTable: string | undefined,
) => {
  const tableName = normalizeOptionalString(newTable);

  if (!tableName || tableName === table) return '';

  return dialect.ddl.getRenameTableDdl(schema, table, tableName, getDdlHelpers(dialect));
};

export const generateCreateTableDdl = (
  dialect: StructureDialect,
  schema: string | undefined,
  table: string,
  changes: {
    columns: StructureColumn[];
    indexes?: StructureIndex[];
    restrictions?: StructureRestriction[];
    references?: StructureReference[];
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
  const tableComment = normalizeOptionalString(changes.tableComment)
    ? dialect.ddl.getTableCommentDdl(tableName, changes.tableComment, helpers)
    : '';
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
  dialect: StructureDialect,
  schema: string | undefined,
  table: string,
  changes: {
    columns: StructureColumn[];
    droppedColumns?: StructureColumn[];
    changedColumns?: StructureColumnChange[];
    indexes?: StructureIndex[];
    droppedIndexes?: StructureIndex[];
    restrictions?: StructureRestriction[];
    droppedRestrictions?: StructureRestriction[];
    references?: StructureReference[];
    droppedReferences?: StructureReference[];
    existingRestrictions?: StructureRestriction[];
    existingReferences?: StructureReference[];
    existingColumns?: StructureColumn[];
    newTableName?: string;
    tableComment?: string;
    tableCommentChanged?: boolean;
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
  const newTableName = normalizeOptionalString(changes.newTableName);
  const tableRenamed = !!newTableName && newTableName !== table;
  const tablePropertiesChanged = tableRenamed || changes.tableCommentChanged;

  if (
    !columns.length &&
    !droppedColumns.length &&
    !changedColumns.length &&
    !indexes.length &&
    !droppedIndexes.length &&
    !restrictions.length &&
    !droppedRestrictions.length &&
    !references.length &&
    !droppedReferences.length &&
    !tablePropertiesChanged
  ) {
    return '';
  }

  const helpers = getDdlHelpers(dialect, restrictions);
  const tableName = getTableName(dialect, schema, table);
  const finalTableName = getTableName(dialect, schema, newTableName || table);
  const droppedColumnNames = new Set(droppedColumns.map((column) => column.column_name));
  const changedColumnsByOriginalName = new Map(
    changedColumns.map((column) => [column.original.column_name, column]),
  );
  const availableColumns = indexes.length ? [
    ...(changes.existingColumns || [])
      .filter((column) => !droppedColumnNames.has(column.column_name))
      .map((column) => changedColumnsByOriginalName.get(column.column_name) || column),
    ...columns,
  ] : [];
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
    generateRenameTableDdl(dialect, schema, table, newTableName),
    changes.tableCommentChanged
      ? dialect.ddl.getTableCommentDdl(finalTableName, changes.tableComment, helpers)
      : '',
  ]
    .filter(Boolean)
    .join('\n\n');
};
