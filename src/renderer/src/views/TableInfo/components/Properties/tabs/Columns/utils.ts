import type { IColumnInfo } from '@shared/types/database';
import type { ColumnGridIdentity } from '@renderer/stores/TableInfo/types';
import type {
  IPendingColumnChange,
  IPendingColumnCreate,
} from '@renderer/database/ddl/types';

export interface IColumnBooleanLabels {
  yes: string;
  no: string;
}

export interface IColumnInfoSerialized extends IColumnInfo {
  is_nullable_label: string;
  is_auto_increment_label: string;
}

export const getColumnSelectionKey = (column: IColumnInfo) =>
  (column as IColumnInfo & { __pendingId?: string }).__pendingId ||
  (column as IPendingColumnChange).__originalColumn?.column_name ||
  column.column_name;

export const getGeneratedConstraintName = (
  table: string,
  type: 'primary_key' | 'unique_key',
  columns: string[],
) => {
  const suffix = type === 'primary_key' ? 'pk' : 'unique';

  return `${table}_${columns.join('_')}_${suffix}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
};

const normalizeBooleanText = (value: unknown) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

export const parseBooleanLabelValue = (value: unknown, labels: IColumnBooleanLabels) => {
  if (typeof value === 'boolean') return value;

  const normalizedValue = normalizeBooleanText(value);
  const normalizedYesLabel = normalizeBooleanText(labels.yes);
  const normalizedNoLabel = normalizeBooleanText(labels.no);

  if (['true', 'sim', 'yes', '1', normalizedYesLabel].includes(normalizedValue)) return true;
  if (['false', 'não', 'nao', 'no', '0', normalizedNoLabel].includes(normalizedValue)) {
    return false;
  }

  return null;
};

export const serializeBooleanLabel = (value: unknown, labels: IColumnBooleanLabels) =>
  value ? labels.yes : labels.no;

export const serializeColumnBooleanLabels = (
  column: IColumnInfo,
  labels: IColumnBooleanLabels,
): IColumnInfoSerialized => ({
  ...column,
  is_nullable_label: serializeBooleanLabel(column.is_nullable, labels),
  is_auto_increment_label: serializeBooleanLabel(column.is_auto_increment, labels),
});

export const getOriginalColumnName = (column: IColumnInfo) =>
  (column as IPendingColumnChange).__originalColumn?.column_name || column.column_name;

export const getColumnGridIdentity = (column: IColumnInfo): ColumnGridIdentity => {
  const created = column as IPendingColumnCreate;
  return created.__pendingId ? { pendingId: created.__pendingId }
    : { originalName: getOriginalColumnName(column) };
};

export const getColumnGridTypeText = (column: IColumnInfo) => column.display_type ?? column.data_type;

export const getEditedColumnFields = (
  column: IPendingColumnChange,
  labels: IColumnBooleanLabels,
) => {
  const originalColumn = serializeColumnBooleanLabels(column.__originalColumn, labels);
  const changedColumn = serializeColumnBooleanLabels(column, labels);
  const editableAttributes = [
    'column_name',
    'data_type',
    'character_maximum_length',
    'numeric_precision',
    'numeric_scale',
    'datetime_precision',
    'is_nullable_label',
    'is_auto_increment_label',
    'column_default',
    'description',
  ] as const satisfies readonly (keyof IColumnInfoSerialized)[];

  return editableAttributes.reduce<Record<string, unknown>>((acc, attribute) => {
    const originalValue =
      attribute === 'data_type' ? (originalColumn.display_type ?? originalColumn.data_type) : originalColumn[attribute];
    const changedValue =
      attribute === 'data_type' ? (changedColumn.display_type ?? changedColumn.data_type) : changedColumn[attribute];

    if (String(originalValue ?? '') !== String(changedValue ?? '')) {
      acc[attribute] = changedValue ?? '';
    }

    return acc;
  }, { display_type: changedColumn.display_type ?? changedColumn.data_type });
};

export const getColumnSearchValues = (column: IColumnInfo, typeText: string) => [
  column.column_name,
  typeText,
];
