import React from 'react';
import { Modal } from '@renderer/components/Modal';
import { Text } from '@renderer/components/Text';
import { Button } from '@renderer/components/Button';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import type { ITableDataConflict } from '@renderer/contexts/Store';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import styles from './styles.module.css';

interface Props {
  conflicts: ITableDataConflict[];
  onClose(): void;
  onDiscardAndReload(): void;
}

const displayValue = (value: unknown) => {
  if (value === null) return 'NULL';
  if (value === undefined) return '—';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const areValuesEqual = (left: unknown, right: unknown) => {
  const serialize = (value: unknown) =>
    JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? String(item) : item));

  try {
    return serialize(left) === serialize(right);
  } catch {
    return Object.is(left, right);
  }
};

const getConflictColumns = (conflict: ITableDataConflict) => {
  const columns = [
    ...new Set([
      ...Object.keys(conflict.original),
      ...Object.keys(conflict.current || {}),
      ...Object.keys(conflict.changes || {}),
    ]),
  ];

  if (conflict.reason !== 'changed') return columns;

  const affectedColumns = columns.filter(
    (column) =>
      !areValuesEqual(conflict.original[column], conflict.current?.[column]) ||
      Object.hasOwn(conflict.changes || {}, column),
  );

  return affectedColumns.length ? affectedColumns : columns;
};

export const ModalDataConflict = ({ conflicts, onClose, onDiscardAndReload }: Props) => {
  const { t } = useI18n();
  const {
    activeTheme: { modal: colors },
  } = useThemeContext();

  return (
    <Modal
      show={!!conflicts.length}
      title={t('dataConflict.title')}
      width="960px"
      maxHeight="85vh"
      onClose={onClose}
    >
      <div
        className={styles.content}
        style={
          {
            color: colors.color,
            '--conflict-border-color': colors.fieldBackgroundColor,
            '--conflict-muted-color': colors.mutedColor || colors.color,
          } as React.CSSProperties
        }
      >
        <Text userSelect={false} color={colors.color}>
          {t('dataConflict.description')}
        </Text>
        <Text userSelect={false} color={colors.color}>
          {t('dataConflict.conflictCount', { count: conflicts.length })}
        </Text>
        <div className={styles.records}>
          {conflicts.map((conflict, index) => (
            <details key={conflict.rowKey} className={styles.record} open={index === 0}>
              <summary className={styles.recordSummary}>
                <strong>{t('dataConflict.record', { number: index + 1 })}</strong>
                <span>{t(`dataConflict.${conflict.reason}`)}</span>
              </summary>
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t('dataConflict.column')}</th>
                      <th>{t('dataConflict.original')}</th>
                      <th>{t('dataConflict.current')}</th>
                      <th>{t('dataConflict.edited')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getConflictColumns(conflict).map((column) => (
                      <tr key={column}>
                        <th>{column}</th>
                        <td>{displayValue(conflict.original[column])}</td>
                        <td>{displayValue(conflict.current?.[column])}</td>
                        <td>
                          {conflict.changes
                            ? displayValue(
                                Object.hasOwn(conflict.changes, column)
                                  ? conflict.changes[column]
                                  : conflict.original[column],
                              )
                            : t('dataConflict.delete')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          ))}
        </div>
        <Text userSelect={false} color={colors.color}>
          {t('dataConflict.reloadWarning')}
        </Text>
        <Row>
          <Spacer />
          <div className={styles.actions}>
            <Button
              width="auto"
              color={colors.neutralButtonColor}
              backgroundColor={colors.neutralButtonBackgroundColor}
              onClick={onClose}
            >
              {t('dataConflict.keepEditing')}
            </Button>
            <Button
              width="auto"
              color={colors.dangerButtonColor}
              backgroundColor={colors.dangerButtonBackgroundColor}
              onClick={onDiscardAndReload}
            >
              {t('dataConflict.reload')}
            </Button>
          </div>
        </Row>
      </div>
    </Modal>
  );
};
