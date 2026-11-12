import React from 'react';
import type { RowChangesIntent } from '@shared/types/rowChanges';
import { getErrorMessage } from '@shared/utils/error';
import { useDatabaseStore } from '@renderer/stores/Database';
import { useI18nStore } from '@renderer/stores/I18n';
import { useToastStore } from '@renderer/stores/Toast';

interface RowChangesPersistenceOptions {
  idConnection: string;
  context: unknown[];
  onSaved: (isCurrent: () => boolean) => void | Promise<void>;
}

// UI lifecycle only. Origin, identity, planning and SQL belong to the main service.
export const useRowChangesPersistence = ({
  idConnection, context, onSaved,
}: RowChangesPersistenceOptions) => {
  const saveRowChanges = useDatabaseStore((state) => state.saveRowChanges);
  const t = useI18nStore((state) => state.t);
  const showToast = useToastStore((state) => state.showToast);
  const [saving, setSaving] = React.useState(false);
  const savingRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const contextRef = React.useRef(context);
  if (context.length !== contextRef.current.length || context.some((value, index) => value !== contextRef.current[index])) {
    contextRef.current = context;
  }
  const renderContext = contextRef.current;

  const save = async (intent: RowChangesIntent) => {
    if (!mountedRef.current || savingRef.current || contextRef.current !== renderContext) return;
    if (!intent.inserts.length && !intent.updates.length && !intent.deletes.length) return;
    savingRef.current = true;
    setSaving(true);
    const isCurrent = () => mountedRef.current && contextRef.current === renderContext;
    try {
      const result = await saveRowChanges(idConnection, intent);
      if (!isCurrent() || result.status === 'empty') return;
      if (result.status === 'rejected') {
        const description = result.reason === 'conflict' ? t('query.conflictingUpdates')
          : result.reason === 'update-only' ? t('query.joinUpdateOnly')
          : result.reason === 'no-primary-key' ? t('query.tableNoPrimaryKey', { table: result.table || '' })
          : result.reason === 'missing-primary-key' ? t('query.rowMissingPk', { pk: result.column || '' })
          : t('query.columnReadOnly');
        showToast({ type: 'warn', title: t('toast.saveNotPossible'), description });
        return;
      }
      showToast({ type: 'success', title: t('toast.dataSaved') });
      await onSaved(isCurrent);
    } catch (error: unknown) {
      if (!isCurrent()) return;
      showToast({ type: 'error', title: t('toast.dataSaveError'),
        description: getErrorMessage(error, t('common.unknownError')), delay: 8000 });
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  };

  React.useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  return { saving, save };
};
