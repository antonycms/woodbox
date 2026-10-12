import type {
  DatabaseCompareOperation,
  DatabaseCompareParams,
  DatabaseCompareItem,
  DatabaseCompareResult,
  DatabaseCompareMessage,
} from '@shared/types/databaseCompare';
import { compareFunctions } from './compare/comparators/functions';
import { compareSequences } from './compare/comparators/sequences';
import { compareTables } from './compare/comparators/tables';
import type { ConnectionGetter } from './compare/types';
import { getSnapshot } from './compare/snapshot';
import { makeItemFactory } from './compare/utils';

export const compareDatabases = async (
  params: DatabaseCompareParams,
  getConnection: ConnectionGetter,
): Promise<DatabaseCompareResult> => {
  const addItem = makeItemFactory();
  const warnings: DatabaseCompareMessage[] = [];
  const [source, target] = await Promise.all([
    getSnapshot(params.sourceConnectionId, params.selectedObjects, params.options, getConnection),
    getSnapshot(params.targetConnectionId, params.selectedObjects, params.options, getConnection),
  ]);

  if (source.connection.dialect !== target.connection.dialect) {
    warnings.push({ code: 'different_dialects' });
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
        details: [{ code: 'selected_objects_equivalent' }],
      }),
    );
  }

  return { items, warnings, summary };
};
