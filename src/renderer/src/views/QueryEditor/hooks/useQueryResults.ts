import React from 'react';
import type { ITab } from '@renderer/components/Tabs/components/TabBar';
import type { IActiveTabContextMenu } from '@renderer/components/Tabs';
import type { IContextMenuOption } from '@renderer/components/ContextMenu';
import { useI18nStore } from '@renderer/stores/I18n';
import { generateHash } from '@shared/utils/string';
import { getTablesFromQuerySql } from '@renderer/utils/sql';
import { getCaptureRowHash } from '../utils/queryResult';
import type { IDataMakeTabResult, IDataUpdateabResult, IQueryResult } from '../dtos';

interface ResultExecution {
  queryExecutionId: string;
  isCurrent: () => boolean;
  update: (params: IDataUpdateabResult) => void;
}

type BeginResultExecutionParams = { queryExecutionId: string } & (
  | { idTab: string; data?: never }
  | { idTab?: never; data: IDataMakeTabResult }
);

export const useQueryResults = (idConnection: string) => {
  const t = useI18nStore((state) => state.t);
  const [resultActiveTabId, setResultActiveTabId] = React.useState<string>(null);

  const [tabsResult, setTabsResult] = React.useState<ITab[]>([]);

  const [querysResultData, setQuerysResultData] = React.useState<Map<React.Key, IQueryResult>>(
    new Map(),
  );
  const tabIdsRef = React.useRef(new Set<string>());
  const scopeRef = React.useRef({ idConnection, active: true, executions: new Map<string, ResultExecution>() });
  if (scopeRef.current.idConnection !== idConnection) {
    scopeRef.current = { idConnection, active: true, executions: new Map() };
  }
  const scope = scopeRef.current;

  const makeUpdateResultTab = React.useCallback((idTab: string, isCurrent: () => boolean = () => true) => {
    const updateTabResultData = (params: IDataUpdateabResult) => {
      if (!isCurrent() || !tabIdsRef.current.has(idTab)) return;
      setQuerysResultData((prevState) => {
        if (!isCurrent() || !prevState.has(idTab)) return prevState;
        const newMap = new Map(prevState);

        const prevTabResultData = prevState.get(idTab);
        const { captureRows, ...dataParams } = params;
        const queryChanged =
          typeof dataParams.query === 'string' &&
          !!prevTabResultData.query &&
          dataParams.query !== prevTabResultData.query;
        const baseTabResultData = queryChanged
          ? { ...prevTabResultData, capture: undefined }
          : prevTabResultData;
        const newTabResultData = { ...baseTabResultData, ...dataParams };

        if (captureRows && newTabResultData.capture?.active && Array.isArray(dataParams.rows)) {
          const rowHashes = new Set(newTabResultData.capture.rowHashes);
          const capturedRows = dataParams.rows.flatMap((row) => {
            const rowHash = getCaptureRowHash(row);

            if (rowHashes.has(rowHash)) return [];

            rowHashes.add(rowHash);

            return [{ captured_at: new Date().toISOString(), row }];
          });

          newTabResultData.capture = {
            ...newTabResultData.capture,
            rows: [...newTabResultData.capture.rows, ...capturedRows],
            rowHashes: [...rowHashes],
          };
        }

        newTabResultData.tables_info = getTablesFromQuerySql(newTabResultData.query);

        newMap.set(idTab, newTabResultData);

        return newMap;
      });
    };

    return updateTabResultData;
  }, []);

  const makeNewTabResult = React.useCallback(
    (data: IDataMakeTabResult) => {
      const {
        loading,
        type,
        columns = [],
        rows = [],
        columns_info,
        column_sources_resolved,
        supports_row_management,
        row_management_table,
        query,
        affected_rows,
        page,
        title,
        variableValues,
        queryExecutionId,
      } = data;

      const idTab = generateHash();

      const queryResultData: IQueryResult = {
        type,
        columns,
        rows,
        loading,
        query,
        page,
        affected_rows,
        columns_info,
        column_sources_resolved,
        supports_row_management,
        row_management_table,
        tables_info: getTablesFromQuerySql(query),
        variableValues,
        queryExecutionId,
      };

      tabIdsRef.current.add(idTab);
      setTabsResult((prevState) => [...prevState, { idTab, title: title ?? `Result ${prevState.length + 1}` }]);
      setResultActiveTabId(idTab);
      setQuerysResultData((prevState) => new Map(prevState).set(idTab, queryResultData));

      return idTab;
    },
    [],
  );

  const beginResultExecution = (params: BeginResultExecutionParams): ResultExecution | undefined => {
    if (scopeRef.current !== scope || !scope.active ||
      (params.idTab !== undefined && !tabIdsRef.current.has(params.idTab))) return;
    const idTab = params.idTab ?? makeNewTabResult(params.data);
    const isCurrent = () => scopeRef.current === scope && scope.active &&
      tabIdsRef.current.has(idTab) && scope.executions.get(idTab) === execution;
    const execution: ResultExecution = {
      queryExecutionId: params.queryExecutionId,
      isCurrent,
      update: makeUpdateResultTab(idTab, isCurrent),
    };
    scope.executions.set(idTab, execution);
    return execution;
  };

  const getResultExecution = (idTab: string, queryExecutionId?: string) => {
    const execution = scope.executions.get(idTab);
    return execution && (queryExecutionId === undefined || execution.queryExecutionId === queryExecutionId)
      && execution.isCurrent() ? execution : undefined;
  };

  const removeTabResult = React.useCallback(
    (idTab: string | string[]) => {
      const tabsIdToRemove = new Set(Array.isArray(idTab) ? idTab : [idTab]);
      for (const id of tabsIdToRemove) {
        tabIdsRef.current.delete(id);
        scopeRef.current.executions.delete(id);
      }

      setTabsResult((prevState) => {
        if (resultActiveTabId && tabsIdToRemove.has(resultActiveTabId)) {
          const activeTabIndex = prevState.findIndex((tab) => tab.idTab === resultActiveTabId);
          const nextTab =
            prevState.slice(activeTabIndex + 1).find((tab) => !tabsIdToRemove.has(tab.idTab)) ||
            prevState
              .slice(0, activeTabIndex)
              .reverse()
              .find((tab) => !tabsIdToRemove.has(tab.idTab));

          setResultActiveTabId(nextTab?.idTab || null);
        }

        return prevState.filter((tab) => !tabsIdToRemove.has(tab.idTab));
      });

      setQuerysResultData((prevState) => {
        const newMap = new Map(prevState);

        tabsIdToRemove.forEach((id) => newMap.delete(id));

        return newMap;
      });
    },
    [resultActiveTabId],
  );

  const toggleResultCapture = (idTab: string) => {
    const tab = querysResultData.get(idTab);

    if (!tab) return;

    const date = new Date().toISOString();
    const updateTabResultData = makeUpdateResultTab(idTab);

    if (tab.capture?.active) {
      updateTabResultData({
        capture: {
          ...tab.capture,
          active: false,
          stopped_at: date,
        },
      });
      return;
    }

    if (tab.capture) {
      updateTabResultData({
        capture: {
          ...tab.capture,
          active: true,
          stopped_at: undefined,
          rowHashes: [
            ...new Set([...tab.capture.rowHashes, ...(tab.rows || []).map(getCaptureRowHash)]),
          ],
        },
      });
      return;
    }

    updateTabResultData({
      capture: {
        active: true,
        started_at: date,
        rows: [],
        rowHashes: (tab.rows || []).map(getCaptureRowHash),
      },
    });
  };

  const clearResultCapture = (idTab: string) => {
    makeUpdateResultTab(idTab)({ capture: undefined });
  };

  const makeResultContextMenuOptions = React.useCallback(
    (paneTabs: ITab[]): IContextMenuOption<IActiveTabContextMenu>[] => [
      {
        text: t('tabs.closeTab'),
        onClick: (info) => removeTabResult(info.tab.idTab),
      },
      tabsResult.length > 1 && {
        text: t('tabs.closeOtherTabs'),
        onClick: (info) => {
          setResultActiveTabId(info.tab.idTab);
          removeTabResult(
            tabsResult.filter((tab) => tab.idTab !== info.tab.idTab).map((tab) => tab.idTab),
          );
        },
      },
      paneTabs.length > 1 && {
        text: t('context.closeTabsLeft'),
        onClick: (info) => {
          removeTabResult(paneTabs.slice(0, info.index).map((tab) => tab.idTab));
        },
      },
      paneTabs.length > 1 && {
        text: t('context.closeTabsRight'),
        onClick: (info) => {
          removeTabResult(paneTabs.slice(info.index + 1).map((tab) => tab.idTab));
        },
      },
      tabsResult.length > 1 && {
        text: t('tabs.closeAllTabs'),
        onClick: () => removeTabResult(tabsResult.map((tab) => tab.idTab)),
      },
    ],
    [removeTabResult, tabsResult, t],
  );

  const handleRemoveResultTab = React.useCallback(
    (tab: ITab) => {
      removeTabResult(tab.idTab);
    },
    [removeTabResult],
  );

  React.useEffect(() => {
    scope.active = true;
    return () => {
      scope.active = false;
      scope.executions.clear();
    };
  }, [scope]);

  return {
    resultActiveTabId,
    tabsResult,
    querysResultData,
    beginResultExecution,
    getResultExecution,
    removeTabResult,
    toggleResultCapture,
    clearResultCapture,
    makeResultContextMenuOptions,
    handleRemoveResultTab,
    setResultActiveTabId,
  };
};
