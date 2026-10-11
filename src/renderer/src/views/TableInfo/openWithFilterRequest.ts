import { create } from 'zustand';

export type TableInfoOpenWithFilterRequest = {
  tabId: string;
  idConnection: string;
  schema?: string;
  table: string;
  initialWhere: string;
};

type TableInfoOpenWithFilterRequestStore = {
  pendingRequest?: TableInfoOpenWithFilterRequest;
  requestOpenWithFilter(request: TableInfoOpenWithFilterRequest): void;
  clearOpenWithFilterRequest(): void;
};

export const useTableInfoOpenWithFilterRequestStore = create<TableInfoOpenWithFilterRequestStore>()(
  (set) => ({
    pendingRequest: undefined,
    requestOpenWithFilter: (request) => set({ pendingRequest: request }),
    clearOpenWithFilterRequest: () => set({ pendingRequest: undefined }),
  }),
);

export const requestOpenTableWithFilter = (request: TableInfoOpenWithFilterRequest) => {
  useTableInfoOpenWithFilterRequestStore.getState().requestOpenWithFilter(request);
};
