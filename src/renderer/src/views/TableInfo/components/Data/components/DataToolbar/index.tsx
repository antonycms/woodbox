import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { RefreshButton } from '@renderer/components/RefreshButton';
import { useI18nStore } from '@renderer/stores/I18n';
import {
  AddIcon,
  CountIcon,
  DuplicateIcon,
  ExportIcon,
  PanelFile,
  RemoveIcon,
  SaveIcon,
} from '@renderer/styles/icons';
import styles from '../../styles.module.css';

interface DataToolbarProps {
  backgroundColor?: string;
  borderColor?: string;
  color?: string;
  isReadOnlyObject: boolean;
  applyingChanges: boolean;
  loadingRowsCount: boolean;
  rowsCount?: number;
  showValuePreview: boolean;
  lastFetchDateSerialized: string;
  onSaveItems: () => void;
  onAddItem: () => void;
  onDuplicateSelectedRows: () => void;
  onRemoveSelectedRows: () => void;
  onToggleValuePreview: () => void;
  onRefresh: () => void | Promise<void>;
  onOpenExportModal: () => void;
  onLoadRowsCount: () => void | Promise<void>;
}

export const DataToolbar = ({
  backgroundColor,
  borderColor,
  color,
  isReadOnlyObject,
  applyingChanges,
  loadingRowsCount,
  rowsCount,
  showValuePreview,
  lastFetchDateSerialized,
  onSaveItems,
  onAddItem,
  onDuplicateSelectedRows,
  onRemoveSelectedRows,
  onToggleValuePreview,
  onRefresh,
  onOpenExportModal,
  onLoadRowsCount,
}: DataToolbarProps) => {
  const { t, language } = useI18nStore(
    useShallow((state) => ({ t: state.t, language: state.language })),
  );

  return (
    <Bar backgroundColor={backgroundColor} borderColor={borderColor}>
      {!isReadOnlyObject && (
        <>
          <Button
            title={t('common.save')}
            text
            smallIcon
            color={color}
            onClick={onSaveItems}
            loading={applyingChanges}
          >
            <SaveIcon size={16} />
          </Button>

          <Button title={t('common.add')} text smallIcon color={color} onClick={onAddItem}>
            <AddIcon size={14} />
          </Button>

          <Button
            title={t('common.duplicateSelectedItems')}
            text
            smallIcon
            color={color}
            onClick={onDuplicateSelectedRows}
          >
            <DuplicateIcon size={20} />
          </Button>

          <Button
            title={t('common.removeSelectedItems')}
            text
            smallIcon
            color={color}
            onClick={onRemoveSelectedRows}
          >
            <RemoveIcon size={16} />
          </Button>
        </>
      )}

      <Button
        title={showValuePreview ? t('tooltip.closeValuePreview') : t('tooltip.openPreview')}
        text
        smallIcon
        color={color}
        onClick={onToggleValuePreview}
      >
        <PanelFile size={16} />
      </Button>

      <RefreshButton menuPlacement="top" color={color} onRefresh={onRefresh} />

      <Button title={t('modal.exportData')} text smallIcon color={color} onClick={onOpenExportModal}>
        <ExportIcon size={16} />
      </Button>

      <Button
        title={t('common.countTotalRows')}
        text
        smallIcon
        className={styles.countButton}
        color={color}
        loading={loadingRowsCount}
        onClick={onLoadRowsCount}
      >
        <CountIcon size={16} />
        {rowsCount !== undefined && (
          <span className={styles.countValue}>{rowsCount.toLocaleString(language)}</span>
        )}
      </Button>

      <Spacer />

      <Text userSelect={false} color={color} title={t('common.lastUpdatedAt')}>
        {t('common.updatedAt', { date: lastFetchDateSerialized })}
      </Text>
    </Bar>
  );
};
