import type { IColumnRestrictionsInfo } from '@shared/types/database';

export const getRestrictionSelectionKey = (restriction: IColumnRestrictionsInfo) =>
  (restriction as IColumnRestrictionsInfo & { __pendingId?: string }).__pendingId ||
  restriction.constraint_name;

export const getRestrictionSearchValues = (restriction: IColumnRestrictionsInfo) => [
  restriction.constraint_name,
  restriction.constraint_type,
  Array.isArray(restriction.column_names)
    ? restriction.column_names.join(', ')
    : restriction.column_names,
  restriction.expression,
  restriction.comment,
];
