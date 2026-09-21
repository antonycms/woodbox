import React from 'react';
import type { ITableSelectedCellData } from '@renderer/components/Table';
import type { IColumnReferenceInfo } from '@shared/types/database';
import type { Dialect } from '@shared/types/connections';
import ReferencePreview from '@renderer/components/ReferencePreview';
import ReferenceValuePreview from '@renderer/components/ReferenceValuePreview';
import ReferenceSelection from '@renderer/components/ReferenceSelection';
import ResizableContainer from '@renderer/components/ResizableContainer';
import { TabBar, TabContent, TabWindow } from '@renderer/components/Tabs';
import type { ITab } from '@renderer/components/Tabs/components/TabBar';
import { Button } from '@renderer/components/Button';
import { useThemeStore } from '@renderer/stores/Theme';
import { useI18nStore } from '@renderer/stores/I18n';
import { generateHash } from '@shared/utils/string';
import IconMdiClose from '~icons/mdi/close';
import styles from './styles.module.css';

type PreviewTab = 'value' | 'reference' | 'selection';
export interface ValuePreviewRequest {
  tab: 'value' | 'reference';
}

interface ValuePreviewProps {
  preview?: ValuePreviewRequest;
  id_connection: string;
  dialect: Dialect;
  selectedCell?: ITableSelectedCellData;
  selectedCellValue: unknown;
  selectedReference?: IColumnReferenceInfo;
  onClose: () => void;
  onOpenTable?: React.ComponentProps<typeof ReferencePreview>['onOpenTable'];
  onDataError: (error: unknown) => void;
  onApplyValue: (value: unknown) => void;
}

export const ValuePreview = ({
  preview,
  id_connection,
  dialect,
  selectedCell,
  selectedCellValue,
  selectedReference,
  onClose,
  onOpenTable,
  onDataError,
  onApplyValue,
}: ValuePreviewProps) => {
  const {
    tableInfo: { tab: tabTheme },
    modal: colors,
  } = useThemeStore((state) => state.activeTheme);
  const t = useI18nStore((state) => state.t);
  const [previewWidth, setPreviewWidth] = React.useState(420);

  const [previewTabBarId] = React.useState(`table_data_preview_${generateHash()}`);

  const [activePreviewTab, setActivePreviewTab] = React.useState<PreviewTab>('value');

  const previewTabs = React.useMemo(
    () =>
      [
        { idTab: 'value', title: t('tabs.value') },
        !!selectedReference && { idTab: 'reference', title: t('reference.singular') },
        !!selectedReference && { idTab: 'selection', title: t('tabs.selection') },
      ].filter(Boolean) as ITab[],
    [!!selectedReference, t],
  );

  const handlePreviewResize = React.useCallback((size: { width?: number }) => {
    if (size.width) setPreviewWidth(size.width);
  }, []);

  const handleActivePreviewTab = React.useCallback((tab?: ITab) => {
    setActivePreviewTab(tab?.idTab as PreviewTab);
  }, []);

  const handleApplySelectedPreviewValue = React.useCallback(
    (value: string) => {
      if (!selectedCell?.column.editable) return;

      onApplyValue(value);
    },
    [onApplyValue, selectedCell],
  );

  React.useEffect(() => {
    setActivePreviewTab(preview?.tab || 'value');
  }, [preview]);

  React.useEffect(() => {
    if (!selectedReference && activePreviewTab !== 'value') {
      setActivePreviewTab('value');
    }
  }, [activePreviewTab, selectedReference]);

  if (!preview) return null;

  return (
    <ResizableContainer
      width={previewWidth}
      minWidth={356}
      maxWidth={900}
      direction="horizontal"
      horizontalResizeSide="left"
      className={styles.previewResizable}
      onResize={handlePreviewResize}
    >
      <div className={styles.preview} style={{ backgroundColor: colors.backgroundColor }}>
        <div className={styles.previewHeader}>
          <TabBar
            borderBottom
            idTabBar={previewTabBarId}
            activeTabId={activePreviewTab}
            onActiveTab={handleActivePreviewTab}
            ascentColor={tabTheme.ascentColor}
            backgroundColor={tabTheme.backgroundColor}
            backgroundColorBar={tabTheme.bar.backgroundColor}
            borderColor={tabTheme.borderColor}
            color={tabTheme.color}
            tabs={previewTabs}
          />

          <Button
            title={t('tooltip.closeValuePreview')}
            backgroundColor={tabTheme.backgroundColor}
            color={tabTheme.color}
            onClick={onClose}
            width="auto"
            icon={() => <IconMdiClose width={16} />}
          />
        </div>

        <TabWindow>
          <TabContent activeTabId={activePreviewTab} idTab="value">
            <ReferenceValuePreview
              key={`${selectedCell?.rowIndex ?? 'none'}:${selectedCell?.colIndex ?? 'none'}`}
              column={selectedCell?.column}
              dialect={dialect}
              readonly={!selectedCell?.column.editable}
              value={selectedCellValue}
              onChange={handleApplySelectedPreviewValue}
            />
          </TabContent>

          {!!selectedReference && (
            <TabContent activeTabId={activePreviewTab} idTab="reference">
              <ReferencePreview
                active={activePreviewTab === 'reference'}
                idConnection={id_connection}
                initialReference={selectedReference}
                initialValue={selectedCellValue}
                onOpenTable={onOpenTable}
              />
            </TabContent>
          )}

          {!!selectedReference && (
            <TabContent activeTabId={activePreviewTab} idTab="selection">
              <ReferenceSelection
                active={activePreviewTab === 'selection'}
                idConnection={id_connection}
                reference={selectedReference}
                onDataError={onDataError}
                onSelectValue={onApplyValue}
              />
            </TabContent>
          )}
        </TabWindow>
      </div>
    </ResizableContainer>
  );
};
