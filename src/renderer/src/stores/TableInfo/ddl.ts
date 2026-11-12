import type { IColumnInfo, IColumnReferenceInfo, IColumnRestrictionsInfo, IIndexInfo } from '@shared/types/database';
import type { StructureColumn, StructureReference, StructureRestriction, StructureIndex, PrepareStructureDdlRequest } from '@shared/types/databaseDdl';
import { useDatabaseStore } from '@renderer/stores/Database';
import { useToastStore } from '@renderer/stores/Toast';
import { useI18nStore } from '@renderer/stores/I18n';
import { getErrorMessage } from '@shared/utils/error';

export const toStructureColumn = (column: IColumnInfo): StructureColumn => ({
  column_name: column.column_name,
  data_type: column.data_type,
  is_nullable: column.is_nullable,
  column_default: column.column_default,
  description: column.description,
  extra: column.extra,
  udt_name: column.udt_name,
  character_maximum_length: column.character_maximum_length,
  numeric_precision: column.numeric_precision,
  numeric_scale: column.numeric_scale,
  datetime_precision: column.datetime_precision,
  is_auto_increment: column.is_auto_increment,
});
export const toStructureReference = (item: IColumnReferenceInfo): StructureReference => ({
  constraint_name: item.constraint_name,
  column_name: item.column_name,
  reference_table_schema: item.reference_table_schema,
  reference_table_name: item.reference_table_name,
  reference_column_name: item.reference_column_name,
  constraint_definition: item.constraint_definition,
  comment: item.comment,
});
export const toStructureRestriction = (item: IColumnRestrictionsInfo): StructureRestriction => ({
  constraint_name: item.constraint_name,
  constraint_type: item.constraint_type,
  constraint_definition: item.constraint_definition,
  column_names: item.column_names,
  expression: item.expression,
  comment: item.comment,
});
export const toStructureIndex = (item: IIndexInfo): StructureIndex => ({
  index_name: item.index_name,
  index_method: item.index_method || '',
  column_names: item.column_names,
  column_orders: item.column_orders,
  is_unique: item.is_unique,
  is_primary: item.is_primary,
});
export const formatStructureDefinitions = (
  definitions: { name: string; sql?: string }[],
): string | undefined => {
  const missing = definitions.filter((item) => !item.sql?.trim());
  if (missing.length) {
    const t = useI18nStore.getState().t;
    useToastStore
      .getState()
      .showToast({
        type: 'warn',
        title: t('ddl.blocked'),
        description: missing
          .map((item) => t('ddl.missingDefinition', { name: item.name }))
          .join('\n'),
        delay: 8000,
      });
    return;
  }
  return (
    definitions
      .map((item) => (item.sql!.endsWith(';') ? item.sql! : `${item.sql};`))
      .join('\n\n') || undefined
  );
};
export const requestStructureDdl = async (
  request: PrepareStructureDdlRequest,
  isCurrent: () => boolean,
): Promise<string | undefined> => {
  try {
    const result = await useDatabaseStore.getState().prepareStructureDdl(request);
    if (!isCurrent()) return;
    const t = useI18nStore.getState().t;
    if (result.status === 'ready' && typeof result.sql === 'string' && result.sql.trim())
      return result.sql;
    if (result.status === 'empty') return;
    if (result.status === 'blocked' && result.diagnostics?.length) {
      const fields = {
        name: t('field.name'),
        type: t('field.type'),
        nullable: t('field.nullable'),
        default: t('field.default'),
        'auto-increment': t('column.autoIncrement'),
        comment: t('field.comment'),
        constraint: t('tabs.constraints'),
        index: t('tabs.indexes'),
        definition: t('ddl.definition'),
      };
      const descriptions = result.diagnostics.map((item) => {
        if (item.code === 'missing-definition')
          return t('ddl.missingDefinition', { name: item.name });
        if (item.code === 'incomplete-intent')
          return t('ddl.incompleteIntent', { name: item.name });
        return t('ddl.unsupported', {
          name: item.name,
          field: fields[item.field] || item.operation,
        });
      });
      useToastStore.getState().showToast({
        type: 'warn',
        title: t('ddl.blocked'),
        description: descriptions.join('\n'),
        delay: 8000,
      });
      return;
    }
    throw Error(t('ddl.previewError'));
  } catch (error) {
    if (isCurrent())
      useToastStore
        .getState()
        .showToast({
          type: 'error',
          title: useI18nStore.getState().t('ddl.previewError'),
          description: getErrorMessage(error, useI18nStore.getState().t('ddl.previewError')),
          delay: 8000,
        });
  }
};
