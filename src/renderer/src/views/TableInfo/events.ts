export const TABLE_INFO_CONFIRM_OPEN_WITH_FILTER_EVENT = '@table-info:confirm-open-with-filter';

export type TableInfoOpenWithFilterRequest = {
  tabId: string;
  idConnection: string;
  schema?: string;
  table: string;
  initialWhere: string;
};

export function emitConfirmOpenTableWithFilter(detail: TableInfoOpenWithFilterRequest) {
  window.setTimeout(() => {
    window.dispatchEvent(new CustomEvent(TABLE_INFO_CONFIRM_OPEN_WITH_FILTER_EVENT, { detail }));
  });
}
