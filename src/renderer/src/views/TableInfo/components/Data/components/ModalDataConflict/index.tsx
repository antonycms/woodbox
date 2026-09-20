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
          } as React.CSSProperties
        }
      >
        <Text userSelect={false} color={colors.color}>
          {t('dataConflict.description')}
        </Text>
        {conflicts.map((conflict, index) => (
          <div key={conflict.rowKey} className={styles.record}>
            <Text bold userSelect={false} color={colors.color}>
              {t('dataConflict.record', { number: index + 1 })} —{' '}
              {t(`dataConflict.${conflict.reason}`)}
            </Text>
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
                  {Object.keys(conflict.original).map((column) => (
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
          </div>
        ))}
        <Text userSelect={false} color={colors.color}>
          {t('dataConflict.reloadWarning')}
        </Text>
        <Row>
          <Spacer />
          <Button
            width="auto"
            color={colors.cancelButtonColor}
            backgroundColor={colors.cancelButtonBackgroundColor}
            onClick={onClose}
          >
            {t('dataConflict.keepEditing')}
          </Button>
          <Button
            width="auto"
            color={colors.saveButtonColor}
            backgroundColor={colors.saveButtonBackgroundColor}
            onClick={onDiscardAndReload}
          >
            {t('dataConflict.reload')}
          </Button>
        </Row>
      </div>
    </Modal>
  );
};
