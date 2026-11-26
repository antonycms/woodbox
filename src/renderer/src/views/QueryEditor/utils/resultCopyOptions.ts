import type { IContextMenuOption } from '@renderer/components/ContextMenu';
import type { ITableContextMenuData } from '@renderer/components/Table';
import type { useI18nStore } from '@renderer/stores/I18n';
import { copyToClipboard } from '@renderer/utils/methods';

export const getResultCopyOptions = (
  t: ReturnType<typeof useI18nStore.getState>['t'],
  data?: ITableContextMenuData | null,
): IContextMenuOption[] => [
  {
    text: t('common.copy'),
    onClick: () => copyToClipboard(data?.getCellsText() || ''),
  },
  {
    text: t('context.copyRow'),
    onClick: () => copyToClipboard(data?.getRowsText() || ''),
  },
  {
    text: t('context.copyRowJson'),
    onClick: () => copyToClipboard(data?.getRowsJson() || ''),
  },
];
