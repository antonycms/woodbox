import type { IColumnReferenceInfo } from '@shared/types/database';

export interface IReferenceSerialized extends IColumnReferenceInfo {
  table_reference: string;
  __pendingId?: string;
}
