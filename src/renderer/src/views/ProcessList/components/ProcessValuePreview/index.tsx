import React from 'react';
import { Button } from '@renderer/components/Button';
import ReferenceValuePreview from '@renderer/components/ReferenceValuePreview';
import ResizableContainer from '@renderer/components/ResizableContainer';
import { TabBar, TabContent, TabWindow } from '@renderer/components/Tabs';
import type { ITableSelectedCellData } from '@renderer/components/Table';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { getRendererDialect } from '@renderer/database/dialects';
import IconMdiClose from '~icons/mdi/close';
import type { ProcessListRow } from '../../utils/rows';
import styles from './styles.module.css';

interface ProcessValuePreviewProps {
  show: boolean;
  id_connection: string;
  selectedCell?: ITableSelectedCellData<ProcessListRow>;
  onClose(): void;
}

export const ProcessValuePreview = ({ show, id_connection, selectedCell, onClose }: ProcessValuePreviewProps) => {
  const t = useI18nStore((state) => state.t);
  const { processList: theme } = useThemeStore((state) => state.activeTheme);
  const connectionDialect = useWorkspaceStore((state) => state.connections.find((connection) => connection.id === id_connection)?.dialect);
  const [previewWidth, setPreviewWidth] = React.useState(420);
  const [previewTabBarId] = React.useState(`process_list_preview_${id_connection}`);
  const [activePreviewTab, setActivePreviewTab] = React.useState('value');
  const dialect = getRendererDialect(connectionDialect);

  const handlePreviewResize = React.useCallback((size: { width?: number }) => {
    if (size.width) setPreviewWidth(size.width);
  }, []);

  if (!show) return null;

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
      <div className={styles.preview}>
        <div className={styles.previewHeader}>
          <TabBar
            borderBottom
            idTabBar={previewTabBarId}
            activeTabId={activePreviewTab}
            onActiveTab={(tab) => setActivePreviewTab(tab?.idTab)}
            ascentColor={theme.tab.ascentColor}
            backgroundColor={theme.tab.backgroundColor}
            backgroundColorBar={theme.tab.bar.backgroundColor}
            borderColor={theme.tab.borderColor}
            color={theme.tab.color}
            tabs={[{ idTab: 'value', title: t('tabs.value') }]}
          />

          <Button
            title={t('tooltip.closeValuePreview')}
            backgroundColor={theme.tab.backgroundColor}
            color={theme.tab.color}
            onClick={onClose}
            width="auto"
            icon={() => <IconMdiClose width={16} />}
          />
        </div>

        <TabWindow>
          <TabContent activeTabId={activePreviewTab} idTab="value">
            <ReferenceValuePreview
              readonly
              language={selectedCell?.column?.attribute == 'query' ? 'sql' : 'json'}
              key={`${selectedCell?.rowIndex ?? 'none'}:${selectedCell?.colIndex ?? 'none'}`}
              column={selectedCell?.column}
              dialect={dialect.editorDialect}
              value={selectedCell?.value}
            />
          </TabContent>
        </TabWindow>
      </div>
    </ResizableContainer>
  );
};
