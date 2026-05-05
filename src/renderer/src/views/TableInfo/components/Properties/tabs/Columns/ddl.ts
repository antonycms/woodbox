import type {
  IColumnInfo,
  IColumnReferenceInfo,
  IColumnRestrictionsInfo,
  IIndexInfo,
  ITriggerInfo,
} from '@renderer/contexts/Store';
import type {
  IPendingColumnCreate,
  IPendingColumnDrop,
  IPendingIndexCreate,
  IPendingIndexDrop,
  IPendingReferenceCreate,
  IPendingReferenceDrop,
  IPendingRestrictionCreate,
  IPendingRestrictionDrop,
} from '@renderer/contexts/TableInfoContext';

const quoteIdent = (value: string) => `"${String(value).replace(/"/g, '""')}"`;

const quoteLiteral = (value: string) => `'${String(value).replace(/'/g, "''")}'`;

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

const getTableName = (schema: string | undefined, table: string) => {
  if (!schema) return quoteIdent(table);

  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
};

export const generateInsertDdl = (
  schema: string | undefined,
  table: string,
  rows: Record<string, any>[],
  columnOrder?: string[],
) => {
  if (!rows.length) return '';

  const tableName = getTableName(schema, table);
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
          (row) =>
            `  (${columns.map((column) => serializeInsertValue(row[column])).join(', ')})`,
        )
        .join(',\n');

      return `INSERT INTO ${tableName} (${columnsSql})\nVALUES\n${valuesSql};`;
    })
    .join('\n\n');
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

const getConstraintName = (table: string, columns: string | string[], suffix: string) => {
  const columnNames = Array.isArray(columns) ? columns.join('_') : columns;

  return `${table}_${columnNames}_${suffix}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
};

const getDropConstraintsDdl = (
  tableName: string,
  droppedColumnNames: Set<string>,
  options: {
    restrictions?: IColumnRestrictionsInfo[];
    references?: IColumnReferenceInfo[];
  },
) => {
  const constraintsToDrop = new Set<string>();

  options.restrictions?.forEach((restriction) => {
    const hasDroppedColumn = restriction.column_names?.some((columnName) =>
      droppedColumnNames.has(columnName),
    );

    if (hasDroppedColumn) constraintsToDrop.add(restriction.constraint_name);
  });

  options.references?.forEach((reference) => {
    if (droppedColumnNames.has(reference.column_name)) {
      constraintsToDrop.add(reference.constraint_name);
    }
  });

  return [...constraintsToDrop].map(
    (constraintName) =>
      `ALTER TABLE ${tableName}\n  DROP CONSTRAINT ${quoteIdent(constraintName)};`,
  );
};

const getDropPendingRestrictionsDdl = (
  tableName: string,
  restrictions: IPendingRestrictionDrop[] = [],
) => {
  const constraintNames = [...new Set(restrictions.map((restriction) => restriction.constraint_name))];

  return constraintNames.map(
    (constraintName) =>
      `ALTER TABLE ${tableName}\n  DROP CONSTRAINT ${quoteIdent(constraintName)};`,
  );
};

const getDropPendingReferencesDdl = (
  tableName: string,
  references: IPendingReferenceDrop[] = [],
) => {
  const constraintNames = [...new Set(references.map((reference) => reference.constraint_name))];

  return constraintNames.map(
    (constraintName) =>
      `ALTER TABLE ${tableName}\n  DROP CONSTRAINT ${quoteIdent(constraintName)};`,
  );
};

const getDropPendingIndexesDdl = (schema: string | undefined, indexes: IPendingIndexDrop[] = []) => {
  const indexNames = [...new Set(indexes.map((index) => index.index_name))];

  return indexNames.map((indexName) => `DROP INDEX ${getTableName(schema, indexName)};`);
};

const getRestrictionDefinition = (restriction: IPendingRestrictionCreate) => {
  if (restriction.constraint_type === 'primary_key') {
    return `PRIMARY KEY (${(restriction.column_names || []).map(quoteIdent).join(', ')})`;
  }

  if (restriction.constraint_type === 'unique_key') {
    return `UNIQUE (${(restriction.column_names || []).map(quoteIdent).join(', ')})`;
  }

  const expression = String(restriction.expression || '').trim();
  if (/^check\s*\(/i.test(expression)) return expression;

  return `CHECK (${expression})`;
};

const getCreateRestrictionsDdl = (
  tableName: string,
  restrictions: IPendingRestrictionCreate[] = [],
) => {
  return restrictions.map(
    (restriction) =>
      `ALTER TABLE ${tableName}\n  ADD CONSTRAINT ${quoteIdent(
        restriction.constraint_name,
      )} ${getRestrictionDefinition(restriction)};`,
  );
};

const getCreateIndexesDdl = (
  schema: string | undefined,
  table: string,
  indexes: IPendingIndexCreate[] = [],
) => {
  const tableName = getTableName(schema, table);

  return indexes.map((index) => {
    const columns = (index.column_names || []).map(quoteIdent).join(', ');
    const method = index.index_method || 'btree';

    return `CREATE INDEX ${quoteIdent(index.index_name)} ON ${tableName} USING ${method} (${columns});`;
  });
};

const getCreateReferencesDdl = (
  tableName: string,
  references: IPendingReferenceCreate[] = [],
) => {
  return references.map((reference) => {
    const referenceTableName = getTableName(
      reference.reference_table_schema,
      reference.reference_table_name,
    );

    return `ALTER TABLE ${tableName}\n  ADD CONSTRAINT ${quoteIdent(
      reference.constraint_name,
    )} FOREIGN KEY (${quoteIdent(reference.column_name)}) REFERENCES ${referenceTableName} (${quoteIdent(
      reference.reference_column_name,
    )});`;
  });
};

export const generateCreateTableDdl = (
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
  const tableName = getTableName(schema, table);

  const columnLines = columns.map((column) => {
    const defaultValue = column.column_default ? ` DEFAULT ${column.column_default}` : '';
    const notNull = column.is_nullable ? '' : ' NOT NULL';

    return `  ${quoteIdent(column.column_name)} ${getColumnType(column)}${defaultValue}${notNull}`;
  });

  const commentOnColumnStatements = columns
    .filter((column) => !!column.description)
    .map(
      (column) =>
        `COMMENT ON COLUMN ${tableName}.${quoteIdent(column.column_name)} IS ${quoteLiteral(
          column.description,
        )};`,
    );

  return [
    `CREATE TABLE ${tableName} (\n${columnLines.join(',\n')}\n);`,
    changes.tableComment?.trim()
      ? `COMMENT ON TABLE ${tableName} IS ${quoteLiteral(changes.tableComment.trim())};`
      : '',
    ...commentOnColumnStatements,
    ...getCreateRestrictionsDdl(tableName, restrictions),
    ...getCreateIndexesDdl(schema, table, indexes),
    ...getCreateReferencesDdl(tableName, references),
  ]
    .filter(Boolean)
    .join('\n\n');
};

export const generatePendingTableChangesDdl = (
  schema: string | undefined,
  table: string,
  changes: {
    columns: IPendingColumnCreate[];
    droppedColumns?: IPendingColumnDrop[];
    indexes?: IPendingIndexCreate[];
    droppedIndexes?: IPendingIndexDrop[];
    restrictions?: IPendingRestrictionCreate[];
    droppedRestrictions?: IPendingRestrictionDrop[];
    references?: IPendingReferenceCreate[];
    droppedReferences?: IPendingReferenceDrop[];
    existingRestrictions?: IColumnRestrictionsInfo[];
    existingReferences?: IColumnReferenceInfo[];
  },
) => {
  const columns = changes.columns || [];
  const droppedColumns = changes.droppedColumns || [];
  const indexes = changes.indexes || [];
  const droppedIndexes = changes.droppedIndexes || [];
  const restrictions = changes.restrictions || [];
  const droppedRestrictions = changes.droppedRestrictions || [];
  const references = changes.references || [];
  const droppedReferences = changes.droppedReferences || [];

  if (
    !columns.length &&
    !droppedColumns.length &&
    !indexes.length &&
    !droppedIndexes.length &&
    !restrictions.length &&
    !droppedRestrictions.length &&
    !references.length &&
    !droppedReferences.length
  ) {
    return '';
  }

  const tableName = getTableName(schema, table);
  const droppedColumnNames = new Set(droppedColumns.map((column) => column.column_name));
  const dropColumnStatements = droppedColumns.map(
    (column) => `ALTER TABLE ${tableName}\n  DROP COLUMN ${quoteIdent(column.column_name)};`,
  );

  const createColumnStatements = columns.flatMap((column) => {
    const defaultValue = column.column_default ? ` DEFAULT ${column.column_default}` : '';
    const notNull = column.is_nullable ? '' : ' NOT NULL';

    const statements: string[] = [];

    statements.push(
      `ALTER TABLE ${tableName}\n  ADD COLUMN ${quoteIdent(column.column_name)} ${getColumnType(
        column,
      )}${defaultValue}${notNull};`,
    );

    if (column.description) {
      statements.push(
        `COMMENT ON COLUMN ${tableName}.${quoteIdent(column.column_name)} IS ${quoteLiteral(
          column.description,
        )};`,
      );
    }

    return statements;
  });

  return [
    ...getDropConstraintsDdl(tableName, droppedColumnNames, {
      restrictions: changes.existingRestrictions,
      references: changes.existingReferences,
    }),
    ...getDropPendingRestrictionsDdl(tableName, droppedRestrictions),
    ...getDropPendingReferencesDdl(tableName, droppedReferences),
    ...getDropPendingIndexesDdl(schema, droppedIndexes),
    ...dropColumnStatements,
    ...createColumnStatements,
    ...getCreateRestrictionsDdl(tableName, restrictions),
    ...getCreateIndexesDdl(schema, table, indexes),
    ...getCreateReferencesDdl(tableName, references),
  ]
    .filter(Boolean)
    .join('\n\n');
};
