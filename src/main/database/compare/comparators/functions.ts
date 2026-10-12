import type { DatabaseCompareItem, DatabaseCompareOptions } from '@shared/types/databaseCompare';
import { getCompareDdlBuilder } from '../../compareDdl';
import { getDialectAdapter } from '../../dialects';
import type { Snapshot } from '../types';
import {
  compareNamedList,
  display,
  normalizeSql,
  pushSemicolon,
  stableStringify,
  type CompareItemFactory,
} from '../utils';

export const compareFunctions = (
  source: Snapshot,
  target: Snapshot,
  options: DatabaseCompareOptions,
  items: DatabaseCompareItem[],
  addItem: CompareItemFactory,
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
    getDisplay: (row) =>
      display(
        row.function_schema,
        `${row.function_name}(${row.function_identity_arguments || ''})`,
      ),
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
    kind: 'function',
    enableRollback: options.enableRollback,
  });
};

