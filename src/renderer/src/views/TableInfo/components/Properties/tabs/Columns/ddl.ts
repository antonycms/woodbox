import type {
  IColumnInfo,
  IColumnReferenceInfo,
  IColumnRestrictionsInfo,
  IIndexInfo,
  ITriggerInfo,
} from '@renderer/contexts/Store';

const quoteIdent = (value: string) => `"${String(value).replace(/"/g, '""')}"`;

const quoteLiteral = (value: string) => `'${String(value).replace(/'/g, "''")}'`;

const getTableName = (schema: string | undefined, table: string) => {
  if (!schema) return quoteIdent(table);

  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
};

const getColumnType = (column: IColumnInfo) => {
  if (
    ['character varying', 'character'].includes(column.data_type) &&
    column.character_maximum_length
  ) {
    return `${column.data_type}(${column.character_maximum_length})`;
  }

  if (['numeric', 'decimal'].includes(column.data_type) && column.numeric_precision) {
    return column.numeric_scale !== undefined && column.numeric_scale !== null
      ? `${column.data_type}(${column.numeric_precision},${column.numeric_scale})`
      : `${column.data_type}(${column.numeric_precision})`;
  }

  if (
    [
      'time without time zone',
      'time with time zone',
      'timestamp without time zone',
      'timestamp with time zone',
    ].includes(column.data_type) &&
    column.datetime_precision !== undefined &&
    column.datetime_precision !== null
  ) {
    return column.data_type.replace(' ', `(${column.datetime_precision}) `);
  }

  return column.data_type === 'USER-DEFINED' && column.udt_name
    ? column.udt_name
    : column.data_type;
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

const getConstraintComment = (tableName: string, constraintName: string, comment?: string) => {
  if (!comment) return '';

  return `\n\nCOMMENT ON CONSTRAINT ${quoteIdent(constraintName)} ON ${tableName} IS ${quoteLiteral(
    comment,
  )};`;
};

const getReferencesDdlBySelectedColumns = (
  tableName: string,
  selectedColumnNames: Set<string>,
  references: IColumnReferenceInfo[] = [],
) => {
  return Object.values(groupByConstraintName(references))
    .map((group) => {
      const constraintColumns = getConstraintColumns(group);
      const [reference] = group;

      if (!hasAllColumnsSelected(constraintColumns, selectedColumnNames)) return null;
      if (!reference.constraint_definition) return null;

      return `ALTER TABLE ${tableName}\n  ADD CONSTRAINT ${quoteIdent(reference.constraint_name)} ${
        reference.constraint_definition
      };${getConstraintComment(tableName, reference.constraint_name, reference.comment)}`;
    })
    .filter((ddl): ddl is string => !!ddl);
};

const getRestrictionsDdlBySelectedColumns = (
  tableName: string,
  selectedColumnNames: Set<string>,
  restrictions: IColumnRestrictionsInfo[] = [],
) => {
  return restrictions
    .map((restriction) => {
      const constraintColumns = restriction.column_names || [];

      if (!hasAllColumnsSelected(constraintColumns, selectedColumnNames)) return null;
      if (!restriction.constraint_definition) return null;

      return `ALTER TABLE ${tableName}\n  ADD CONSTRAINT ${quoteIdent(
        restriction.constraint_name,
      )} ${restriction.constraint_definition};${getConstraintComment(
        tableName,
        restriction.constraint_name,
        restriction.comment,
      )}`;
    })
    .filter((ddl): ddl is string => !!ddl);
};

export const generateReferencesDdl = (
  schema: string | undefined,
  table: string,
  references: IColumnReferenceInfo[],
) => {
  const tableName = getTableName(schema, table);
  const constraints = new Map<string, IColumnReferenceInfo>();

  references.forEach((reference) => {
    if (!constraints.has(reference.constraint_name)) {
      constraints.set(reference.constraint_name, reference);
    }
  });

  return [...constraints.values()]
    .map((reference) => {
      if (!reference.constraint_definition) return null;

      return `ALTER TABLE ${tableName}\n  ADD CONSTRAINT ${quoteIdent(reference.constraint_name)} ${
        reference.constraint_definition
      };${getConstraintComment(tableName, reference.constraint_name, reference.comment)}`;
    })
    .filter((ddl): ddl is string => !!ddl)
    .join('\n\n');
};

export const generateRestrictionsDdl = (
  schema: string | undefined,
  table: string,
  restrictions: IColumnRestrictionsInfo[],
) => {
  const tableName = getTableName(schema, table);

  return restrictions
    .map((restriction) => {
      if (!restriction.constraint_definition) return null;

      return `ALTER TABLE ${tableName}\n  ADD CONSTRAINT ${quoteIdent(
        restriction.constraint_name,
      )} ${restriction.constraint_definition};${getConstraintComment(
        tableName,
        restriction.constraint_name,
        restriction.comment,
      )}`;
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

export const generateAddColumnsDdl = (
  schema: string | undefined,
  table: string,
  columns: IColumnInfo[],
  options?: {
    references?: IColumnReferenceInfo[];
    restrictions?: IColumnRestrictionsInfo[];
  },
) => {
  if (!columns?.length) return '';

  const tableName = getTableName(schema, table);
  const selectedColumnNames = new Set(columns.map((column) => column.column_name));

  const columnsDdl = columns.map((column) => {
    const defaultValue = column.column_default ? ` DEFAULT ${column.column_default}` : '';
    const notNull = column.is_nullable ? '' : ' NOT NULL';
    const addColumn = `ALTER TABLE ${tableName}\n  ADD COLUMN ${quoteIdent(
      column.column_name,
    )} ${getColumnType(column)}${defaultValue}${notNull};`;

    if (!column.description) return addColumn;

    return `${addColumn}\n\nCOMMENT ON COLUMN ${tableName}.${quoteIdent(
      column.column_name,
    )} IS ${quoteLiteral(column.description)};`;
  });

  return [
    ...columnsDdl,
    ...getRestrictionsDdlBySelectedColumns(tableName, selectedColumnNames, options?.restrictions),
    ...getReferencesDdlBySelectedColumns(tableName, selectedColumnNames, options?.references),
  ].join('\n\n');
};
