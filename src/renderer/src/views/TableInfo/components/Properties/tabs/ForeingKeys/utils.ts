import type { IColumnReferenceInfo } from '@shared/types/database';
import type { IReferenceSerialized } from './dtos';

export const getReferenceSelectionKey = (reference: IColumnReferenceInfo) =>
  (reference as IColumnReferenceInfo & { __pendingId?: string }).__pendingId ||
  `${reference.constraint_name}-${reference.column_name}`;

export const getReferenceSearchValues = (reference: IReferenceSerialized) => [
  reference.constraint_name,
  reference.column_name,
  reference.table_reference,
  reference.reference_column_name,
  reference.comment,
  reference.remove_rule,
  reference.update_rule,
];
