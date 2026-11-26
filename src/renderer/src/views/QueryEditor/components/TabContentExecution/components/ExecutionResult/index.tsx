import React from 'react';
import { ContextMenu, type IContextMenuPosition } from '@renderer/components/ContextMenu';
import Table, { type ITableContextMenuData } from '@renderer/components/Table';
import { ROW_HEIGHT } from '@renderer/components/Table/constants';
import { useI18nStore } from '@renderer/stores/I18n';
import { getResultCopyOptions } from '../../../../utils/resultCopyOptions';
import type { IQueryResult } from '../../../../dtos';
import styles from './styles.module.css';

interface ExecutionResultProps {
  data: IQueryResult;
}

export const ExecutionResult = ({ data }: ExecutionResultProps) => {
  const t = useI18nStore((state) => state.t);
  const [menu, setMenu] = React.useState<{ position: IContextMenuPosition; data: ITableContextMenuData }>();
  const closeMenu = React.useCallback(() => setMenu(undefined), []);
  const options = React.useMemo(() => getResultCopyOptions(t, menu?.data), [t, menu]);

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
          onContextMenu={(event, selection) => {
            setMenu({ position: { x: event.clientX, y: event.clientY }, data: selection });
          }}
          loading={!!data.loading}
          rows={data.rows ?? []}
          columns={(data.columns ?? []).map((name) => ({ label: name, attribute: name, editable: false }))}
        />
      </div>
      <ContextMenu position={menu?.position} options={options} onClose={closeMenu} />
    </>
  );
};
