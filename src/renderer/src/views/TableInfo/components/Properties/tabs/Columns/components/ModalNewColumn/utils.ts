import type { NewColumnDraft, PreparedColumnDraft, ColumnToggle } from './types';

// Form normalization only. No SQL parser, driver allowlist or connection access.
export const prepareColumnDraft = (draft: NewColumnDraft, defaultIndexMethod: string,
  eligible: boolean | undefined, hasReferenceColumn: boolean): PreparedColumnDraft => {
  const columnName = draft.column_name.trim();
  const dataType = draft.data_type.trim();
  if (!columnName || !dataType) return { status: 'incomplete' };
  if (draft.is_foreign_key && !hasReferenceColumn) {
    return { status: 'incomplete' };
  }
  if (draft.is_unique && draft.column_default.trim()) {
    return { status: 'blocked', reason: 'unique-default' };
  }
  if (draft.is_auto_increment && eligible === false) {
    return { status: 'blocked', reason: 'auto-type' };
  }
  if (draft.is_auto_increment && !draft.is_primary_key && !draft.is_unique) {
    return { status: 'blocked', reason: 'auto-needs-key' };
  }
  return {
    status: 'ready',
    defaultIndexMethod,
    column: {
      column_name: columnName,
      display_type: dataType,
      ...(eligible === undefined ? {} : { auto_increment_eligible: eligible }),
      data_type: dataType,
      character_maximum_length: undefined,
      numeric_precision: undefined,
      numeric_scale: undefined,
      datetime_precision: undefined,
      is_nullable: draft.is_auto_increment ? false : !draft.required,
      column_default: draft.is_auto_increment ? undefined : draft.column_default.trim() || undefined,
      is_auto_increment: draft.is_auto_increment,
      description: draft.description.trim() || undefined,
    },
    constraintType: draft.is_primary_key ? 'primary_key' : draft.is_unique ? 'unique_key' : undefined,
  };
};

type NewColumnTransitionChanges = Partial<Pick<NewColumnDraft,
  'is_primary_key' | 'is_unique' | 'is_auto_increment' | 'required' | 'column_default' | 'is_foreign_key'>>;
const changeAutoIncrement = (
  draft: NewColumnDraft, checked: boolean, hasPrimaryKey: boolean,
): NewColumnTransitionChanges => ({
  is_auto_increment: checked,
  required: checked ? true : draft.required,
  column_default: checked ? '' : draft.column_default,
  is_primary_key: checked && !hasPrimaryKey ? true : draft.is_primary_key,
  is_unique: checked && hasPrimaryKey ? true : draft.is_unique,
  is_foreign_key: checked ? false : draft.is_foreign_key,
});

export const getColumnToggleChanges = (draft: NewColumnDraft, intent: ColumnToggle, hasPrimaryKey: boolean): NewColumnTransitionChanges => {
  let changes: NewColumnTransitionChanges = {};
  if (intent.type === 'toggle-primary-key') {
    changes = {
      is_primary_key: intent.checked,
      is_unique: intent.checked ? false : draft.is_unique,
      is_auto_increment: !intent.checked && !draft.is_unique ? false : draft.is_auto_increment,
    };
  } else if (intent.type === 'toggle-unique') {
    changes = {
      is_unique: intent.checked,
      is_primary_key: intent.checked ? false : draft.is_primary_key,
      is_auto_increment: !intent.checked && !draft.is_primary_key ? false : draft.is_auto_increment,
    };
  } else if (intent.type === 'toggle-auto-increment') {
    changes = changeAutoIncrement(draft, intent.checked, hasPrimaryKey);
  }
  return changes;
};
