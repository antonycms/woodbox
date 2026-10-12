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

export const compareSequences = (
  source: Snapshot,
  target: Snapshot,
  options: DatabaseCompareOptions,
  items: DatabaseCompareItem[],
  addItem: CompareItemFactory,
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
    getDisplay: (row) => display(row.sequence_schema, row.sequence_name),
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
    kind: 'sequence',
    enableRollback: options.enableRollback,
  });
};

