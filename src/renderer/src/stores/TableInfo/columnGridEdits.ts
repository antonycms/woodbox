import type { IColumnInfo } from '@shared/types/database';
import type { ColumnGridDiagnostic, ColumnGridEdit } from './types';

const comparedAttributes = [
  'column_name', 'data_type', 'character_maximum_length', 'numeric_precision',
  'numeric_scale', 'datetime_precision', 'is_nullable', 'column_default',
  'is_auto_increment', 'description',
] as const;

export const hasColumnChanges = (original: IColumnInfo, column: IColumnInfo) =>
  comparedAttributes.some((attribute) => {
    const before = original[attribute] === '' ? undefined : original[attribute];
    const after = column[attribute] === '' ? undefined : column[attribute];
    return before !== after;
  });

// Returns only the fields changed by this cell, or the reason it was rejected.
export const getColumnEditChanges = (
  column: IColumnInfo,
  original: IColumnInfo,
  edit: ColumnGridEdit,
  eligibility: ReadonlyMap<string, boolean>,
  isNameTaken: (name: string) => boolean,
): Partial<IColumnInfo> | ColumnGridDiagnostic => {
  switch (edit.attribute) {
    case 'column_name': {
      const name = String(edit.value ?? '').trim();
      if (!name) return 'name-required';
      if (isNameTaken(name)) return 'duplicate-name';
      return { column_name: name };
    }
    case 'data_type': {
      const text = String(edit.value ?? '').trim();
      if (!text) return 'type-required';

      // Reusing a known display label also restores its canonical type and precision.
      let matching: IColumnInfo;
      if (text === (original.display_type ?? original.data_type)) matching = original;
      else if (text === (column.display_type ?? column.data_type)) matching = column;

      return {
        data_type: matching?.data_type || text,
        display_type: text,
        auto_increment_eligible: matching?.auto_increment_eligible ?? eligibility.get(text),
        character_maximum_length: matching?.character_maximum_length,
        numeric_precision: matching?.numeric_precision,
        numeric_scale: matching?.numeric_scale,
        datetime_precision: matching?.datetime_precision,
        ...(matching ? { udt_name: matching.udt_name } : {}),
      };
    }
    case 'is_nullable':
      if (edit.value === null) return 'invalid-nullable';
      return { is_nullable: edit.value };
    case 'is_auto_increment':
      if (edit.value === null) return 'invalid-auto-increment';
      // Unknown free types are validated by main when generating DDL.
      if (edit.value && (column.auto_increment_eligible ?? eligibility.get(column.data_type)) === false) {
        return 'auto-type';
      }
      return {
        is_auto_increment: edit.value,
        ...(edit.value ? { column_default: undefined, is_nullable: false } : {}),
      };
    default:
      return { [edit.attribute]: String(edit.value ?? '').trim() || undefined };
  }
};
