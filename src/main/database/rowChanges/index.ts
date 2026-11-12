import type { SaveRowChangesResult, RowChangesIntent, TableRowChangesIntent } from '@shared/types/rowChanges';
import type { DatabaseDialectAdapter, IConnection } from '../types';
import { planRowChanges } from './planner';
import { executeRowChanges, executeTableRowChanges } from './executor';

const isTableIntent = (intent: RowChangesIntent): intent is TableRowChangesIntent => intent.source.type === 'table';

export const saveRowChanges = async (
  connection: IConnection,
  adapter: DatabaseDialectAdapter,
  intent: RowChangesIntent,
): Promise<SaveRowChangesResult> => {
  if (isTableIntent(intent)) {
    const inserts = intent.inserts.filter((row) => Object.keys(row).length);
    const updates = intent.updates.filter((row) => Object.keys(row.values).length);
    if (!inserts.length && !updates.length && !intent.deletes.length) return { status: 'empty' };
    await connection.instance.transaction(async (trx) => {
      await executeTableRowChanges(trx, adapter, { ...intent, inserts, updates });
    });
    return { status: 'saved' };
  }
  return connection.instance.transaction(async (trx): Promise<SaveRowChangesResult> => {
    const prepared = await planRowChanges(trx, adapter, intent);
    if ('result' in prepared) return prepared.result;
    await executeRowChanges(trx, adapter, prepared.plan);
    return { status: 'saved' };
  });
};
