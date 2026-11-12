import React from 'react';
import type { Dialect } from '@shared/types/connections';
import type { DatabaseRow } from '@shared/types/database';
import { getErrorMessage } from '@shared/utils/error';
import { useDatabaseStore } from '@renderer/stores/Database';
import { useI18nStore } from '@renderer/stores/I18n';
import { useToastStore } from '@renderer/stores/Toast';

interface InsertDmlPreviewOptions {
  idConnection: string;
  policyId: Dialect;
  schema?: string;
  table?: string;
  query?: string;
  resultRevision?: string | number;
  menu?: object;
}

// UI lifetime only. The main service owns all SQL generation.
export const useInsertDmlPreview = ({
  idConnection, policyId, schema, table, query, resultRevision, menu,
}: InsertDmlPreviewOptions) => {
  const prepareInsertDml = useDatabaseStore((state) => state.prepareInsertDml);
  const t = useI18nStore((state) => state.t);
  const showToast = useToastStore((state) => state.showToast);
  const [preview, setPreview] = React.useState<{ sql: string; context: object }>();
  const mounted = React.useRef(true);
  const ticket = React.useRef(0);
  const menuRef = React.useRef(menu);
  const values = [idConnection, policyId, schema, table, query, resultRevision];
  const valuesRef = React.useRef(values);
  const contextRef = React.useRef<object>({});
  if (values.some((value, index) => value !== valuesRef.current[index])) {
    valuesRef.current = values;
    contextRef.current = {};
    ticket.current++;
  }
  // Normal click dismissal sets menu to undefined; it must NOT cancel the action.
  if (menu && menu !== menuRef.current) ticket.current++;
  menuRef.current = menu;
  const context = contextRef.current;

  const close = React.useCallback(() => {
    ticket.current++;
    setPreview(undefined);
  }, []);

  const prepare = React.useCallback(async (selectedRows: DatabaseRow[], columnOrder?: string[]) => {
    if (!mounted.current || contextRef.current !== context || table === undefined) return;
    const requestTicket = ++ticket.current;
    const isCurrent = () => mounted.current && contextRef.current === context && ticket.current === requestTicket;
    setPreview(undefined);
    try {
      const sql = await prepareInsertDml({ policyId, target: { schema, table }, rows: selectedRows, columnOrder });
      if (isCurrent()) setPreview({ sql, context });
    } catch (error: unknown) {
      if (!isCurrent()) return;
      showToast({ type: 'error', title: t('dml.previewError'),
        description: getErrorMessage(error, t('common.unknownError')) });
    }
  }, [context, policyId, schema, table, prepareInsertDml, showToast, t]);

  React.useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; ticket.current++; };
  }, []);

  return { sql: preview?.sql || '', show: !!preview && preview.context === context, prepare, close };
};
