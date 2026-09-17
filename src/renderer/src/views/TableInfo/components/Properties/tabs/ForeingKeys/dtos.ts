import type { IColumnReferenceInfo } from '@renderer/contexts/Store';

export interface IReferenceSerialized extends IColumnReferenceInfo {
  table_reference: string;
  __pendingId?: string;
}
