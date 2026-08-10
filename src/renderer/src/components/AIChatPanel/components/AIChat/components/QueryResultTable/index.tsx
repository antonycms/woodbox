import React from 'react';
import Table from '@renderer/components/Table';
import type { IColumn } from '@renderer/components/Table/dtos';
import type { IAIQueryResult } from '@renderer/contexts/Store';
import styles from '../../styles.module.css';

interface IQueryResultTableProps {
  result?: IAIQueryResult;
}

const getColumns = (result: IAIQueryResult): IColumn<Record<string, unknown>>[] => {
  const attributes = result.columns?.length
    ? result.columns
    : [...new Set(result.rows.flatMap((row) => Object.keys(row)))];

  return attributes.map((attribute) => ({
    label: attribute,
    attribute,
    resizable: true,
  }));
};

export const QueryResultTable = React.memo(({ result }: IQueryResultTableProps) => {
  const rows = result?.rows || [];
  const columns = React.useMemo(() => (result ? getColumns(result) : []), [result]);

  if (!result || !columns.length) return null;

  return (
    <>
      <p style={{ margin: '4px 0 14px 0' }}>Resultado da query:</p>

      <div className={styles.queryResultTable}>
        <Table rows={rows} columns={columns} rowKeyExtractor={(_, index) => index} />
      </div>
      </>
  );
});

QueryResultTable.displayName = 'QueryResultTable';
