import React from 'react';
import type { ITab } from '@renderer/components/Tabs/components/TabBar';
import type { IActiveTabContextMenu } from '@renderer/components/Tabs';
import type { IContextMenuOption } from '@renderer/components/ContextMenu';
import { useI18nStore } from '@renderer/stores/I18n';
import { generateHash } from '@shared/utils/string';
import { getTablesFromQuerySql } from '@renderer/utils/sql';
import { getCaptureRowHash } from '../utils/queryResult';
import type { IDataMakeTabResult, IDataUpdateabResult, IQueryResult } from '../dtos';

export const useQueryResults = () => {
  const t = useI18nStore((state) => state.t);
  const [resultActiveTabId, setResultActiveTabId] = React.useState<string>(null);

  const [tabsResult, setTabsResult] = React.useState<ITab[]>([]);

  const [querysResultData, setQuerysResultData] = React.useState<Map<React.Key, IQueryResult>>(
    new Map(),
  );

  const makeUpdateResultTab = React.useCallback((idTab: string) => {
    const updateTabResultData = (params: IDataUpdateabResult) => {
      setQuerysResultData((prevState) => {
        const newMap = new Map(prevState);

        const prevTabResultData = prevState.get(idTab) || ({} as IQueryResult);
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
        query,
        affected_rows,
        page,
        title = `Result ${tabsResult.length + 1}`,
        variableValues,
        queryExecutionId,
      } = data;

      const idTab = generateHash();

      const tab: ITab = {
        idTab,
        title,
      };

      const queryResultData: IQueryResult = {
        type,
        columns,
        rows,
        loading,
        query,
        page,
        affected_rows,
        columns_info,
        tables_info: getTablesFromQuerySql(query),
        variableValues,
        queryExecutionId,
      };

      setTabsResult((prevState) => [...prevState, tab]);
      setResultActiveTabId(idTab);

      const updateTabResultData = makeUpdateResultTab(idTab);

      updateTabResultData(queryResultData);

      return updateTabResultData;
    },
    [makeUpdateResultTab, tabsResult.length],
  );

  const removeTabResult = React.useCallback(
    (idTab: string | string[]) => {
      const tabsIdToRemove = new Set(Array.isArray(idTab) ? idTab : [idTab]);

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

  return {
    resultActiveTabId,
    tabsResult,
    querysResultData,
    makeUpdateResultTab,
    makeNewTabResult,
    removeTabResult,
    toggleResultCapture,
    clearResultCapture,
    makeResultContextMenuOptions,
    handleRemoveResultTab,
    setResultActiveTabId,
  };
};
