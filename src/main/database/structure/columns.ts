import type { ColumnAutoIncrementRequest } from '@shared/types/databaseStructure';
import type { IColumnInfo, DatabaseStructureOptions } from '@shared/types/database';
import type { DatabaseDialectAdapter } from '../types';
import { getDialectAdapter } from '../dialects';

export const getStructureOptions = (adapter: DatabaseDialectAdapter): DatabaseStructureOptions => ({
  ...(adapter.staticColumnTypes ? { columnTypeSuggestions: {
    types: adapter.staticColumnTypes.map((name) => ({ name })),
    commonTypes: [...adapter.commonColumnTypes],
    autoIncrementTypes: Object.fromEntries(
      [...new Set([...adapter.commonColumnTypes, ...adapter.staticColumnTypes])].map((name) =>
        [name, !adapter.columnEditing || adapter.columnEditing.canUseAutoIncrement(name)]),
    ),
  } } : {}),
  supportsAutoIncrement: Boolean(adapter.columnEditing),
  indexMethods: [...adapter.indexMethods],
  defaultIndexMethod: adapter.indexMethods[0] || '',
  fallbackColumnTypes: ['varchar', 'text', 'integer', 'serial', 'boolean'],
});

export const getColumnGridPresentation = (
  column: Pick<IColumnInfo, 'data_type' | 'character_maximum_length' | 'numeric_precision' | 'numeric_scale' | 'udt_name'>,
) => {
  if (column.character_maximum_length) {
    return { typeText: `${column.data_type}(${column.character_maximum_length})` };
  }
  if (column.numeric_precision && column.numeric_scale) {
    return { typeText: `${column.data_type}(${column.numeric_precision},${column.numeric_scale})` };
  }
  if (column.data_type === 'USER-DEFINED' && column.udt_name) {
    return { typeText: column.udt_name };
  }
  return { typeText: column.data_type };
};

// Adapter eligibility only: no names, drafts, dirty tracking or UI snapshots.
export const getColumnAutoIncrementSupport = ({ policyId, dataTypes }: ColumnAutoIncrementRequest): boolean[] => {
  const editing = getDialectAdapter(policyId).columnEditing;
  return dataTypes.map((type) => !editing || editing.canUseAutoIncrement(type));
};
