import React from 'react';
import type { ITableSelectedCellData } from '@renderer/components/Table';
import type { ITab } from '@renderer/components/Tabs/components/TabBar';
import { useI18nStore } from '@renderer/stores/I18n';
import type { IQueryResult } from '@renderer/views/QueryEditor/dtos';
import type { IColumnReferenceInfo } from '@shared/types/database';

export type PreviewTab = 'value' | 'reference' | 'selection';

interface UseQueryResultPreviewParams {
  data: IQueryResult;
  references: Map<string, IColumnReferenceInfo[]>;
  selectedCell?: ITableSelectedCellData;
  editedFieldsRows: Map<React.Key, Record<string, unknown>>;
  newRows: Map<React.Key, Record<string, unknown>>;
}

export const useQueryResultPreview = ({
  data,
  references,
  selectedCell,
  editedFieldsRows,
  newRows,
}: UseQueryResultPreviewParams) => {
  const t = useI18nStore((state) => state.t);
  const [showValuePreview, setShowValuePreview] = React.useState(false);
  const [previewWidth, setPreviewWidth] = React.useState(420);
  const [activePreviewTab, setActivePreviewTab] = React.useState<PreviewTab>('value');

  const closeValuePreview = React.useCallback(() => {
    setShowValuePreview(false);
    setActivePreviewTab('value');
  }, []);

  const selectedCellValue = React.useMemo(() => {
    if (!selectedCell) return undefined;

    const row = selectedCell.row;
    const attribute = String(selectedCell.column.attribute);
    const editedRow = editedFieldsRows.get(row.__key_row);
    const newRow = newRows.get(row.__key_row);

    if (newRow && attribute in newRow) return newRow[attribute];
    if (editedRow && attribute in editedRow) return editedRow[attribute];

    return row[attribute];
  }, [editedFieldsRows, newRows, selectedCell]);

  const tabFkMap = React.useMemo(() => {
    const map = new Map<string, IColumnReferenceInfo>();

    data?.tables_info?.forEach?.(({ name, schema }) => {
      const key = `${schema ? schema + '.' : ''}${name}`;

      references.get(key)?.forEach((ref) => map.set(ref.column_name, ref));
    });

    return map;
  }, [data?.tables_info, references]);

  const selectedReference = selectedCell
    ? tabFkMap.get(String(selectedCell.column.attribute))
    : undefined;

  const canSelectReferenceValue = !!selectedReference && selectedCell?.column.editable === true;

  const previewTabs = React.useMemo(
    () =>
      [
        { idTab: 'value', title: t('tabs.value') },
        selectedReference && { idTab: 'reference', title: t('reference.singular') },
        canSelectReferenceValue && { idTab: 'selection', title: t('tabs.selection') },
      ].filter(Boolean) as ITab[],
    [canSelectReferenceValue, selectedReference, t],
  );

  const toggleValuePreview = React.useCallback(() => {
    if (showValuePreview) {
      closeValuePreview();
      return;
    }

    setShowValuePreview(true);
  }, [closeValuePreview, showValuePreview]);

  const handlePreviewResize = React.useCallback((size: { width?: number }) => {
    if (size.width) setPreviewWidth(size.width);
  }, []);

  const handleActivePreviewTab = React.useCallback((tab?: ITab) => {
    setActivePreviewTab(tab?.idTab as PreviewTab);
  }, []);

  const openReferencePreview = React.useCallback(() => {
    setShowValuePreview(true);
    setActivePreviewTab('reference');
  }, []);

  React.useEffect(() => {
    if (!selectedReference && activePreviewTab !== 'value') {
      setActivePreviewTab('value');
      return;
    }

    if (activePreviewTab === 'selection' && !canSelectReferenceValue) {
      setActivePreviewTab(selectedReference ? 'reference' : 'value');
    }
  }, [activePreviewTab, canSelectReferenceValue, selectedReference]);

  return {
    showValuePreview,
    previewWidth,
    activePreviewTab,
    selectedCellValue,
    tabFkMap,
    selectedReference,
    canSelectReferenceValue,
    previewTabs,
    closeValuePreview,
    toggleValuePreview,
    handlePreviewResize,
    handleActivePreviewTab,
    openReferencePreview,
  };
};
