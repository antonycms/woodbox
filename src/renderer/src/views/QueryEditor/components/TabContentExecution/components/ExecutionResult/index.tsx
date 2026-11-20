import React from 'react';
import Table from '@renderer/components/Table';
import { ROW_HEIGHT } from '@renderer/components/Table/constants';
import type { IQueryResult } from '../../../../dtos';
import styles from './styles.module.css';

interface ExecutionResultProps {
  data: IQueryResult;
}

export const ExecutionResult = ({ data }: ExecutionResultProps) => {
  return (
    <>
      <details className={styles.sql}>
        <summary>
          <pre>{data.query}</pre>
        </summary>
      </details>
      <div
        className={styles.content}
        style={data.columns?.length ? {
          height: (Math.min(data.rows?.length ?? 0, 4) + 1) * ROW_HEIGHT + 12,
        } : data.loading ? { height: ROW_HEIGHT * 2 } : undefined}
      >
        <Table
          loading={!!data.loading}
          rows={data.rows ?? []}
          columns={(data.columns ?? []).map((name) => ({ label: name, attribute: name, editable: false }))}
        />
      </div>
    </>
  );
};
