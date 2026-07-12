import React from 'react';
import ReactDOM from 'react-dom';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import { useStoreContext, type IFunctionDb, type IScript } from '@renderer/contexts/Store';
import { QueryEditor } from '@renderer/views/QueryEditor';
import TableInfo from '@renderer/views/TableInfo';
import FunctionInfo from '@renderer/views/FunctionInfo';
import IconItemTreeView from '@renderer/components/TreeView/IconItemTreeView';
import { VirtualizeList } from '@renderer/components/VirtualizeList';
import { classes, toCssProperties } from '@renderer/styles/theme';
import { useThemeContext } from '@renderer/contexts/Theme';
import type { ICentralSearchItem, ICentralSearchItemType, ICentralSearchRow } from './dtos';
import styles from './styles.module.css';
import * as constants from './constants';

export const CentralSearchModal = React.memo(() => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchText, setSearchText] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  const { tabs, addTab, getTab, activeTabId, setActiveTabId } = useAppTabContext();
  const { scripts, connections, connectionsInfo } = useStoreContext();
  const {
    activeTheme: {
      __colors,
      modal: { backgroundColor, color, fieldBackgroundColor, fieldColor },
    },
  } = useThemeContext();

  const parsedSearch = constants.parseSearchText(searchText);

  const getConnectionDescription = React.useCallback(
    (idConnection: string) => {
      const connectionById = new Map(connections.map((connection) => [connection.id, connection]));
      return connectionById.get(idConnection)?.description;
    },
    [connections],
  );

  const openScriptTab = React.useCallback(
    (script: IScript) => {
      const tabId = constants.getScriptTabId(script.id);
      const tab = getTab(tabId);

      if (tab) return setActiveTabId(tabId);

      addTab({
        id: tabId,
        title: script.name,
        data: {
          type: 'query-editor',
          id_connection: script.id_connection,
          id_script: script.id,
          name: script.name,
        },
        component: () => <QueryEditor id_connection={script.id_connection} id_script={script.id} />,
      });
    },
    [addTab, getTab, setActiveTabId],
  );

  const openTableTab = React.useCallback(
    (idConnection: string, schema: string | undefined, table: string, initialWhere?: string) => {
      if (initialWhere) {
        addTab({
          title: `${constants.getQualifiedName(schema, table)} [${initialWhere}]`,
          data: {
            type: 'table-info',
            id_connection: idConnection,
            schema,
            table,
            initialWhere,
            filterLocked: true,
            initialTab: 'tabData',
          },
          component: () => (
            <TableInfo
              id_connection={idConnection}
              schema={schema}
              table={table}
              initialWhere={initialWhere}
              filterLocked
              initialTab="tabData"
            />
          ),
        });

        return;
      }

      const tabId = constants.getTableTabId(idConnection, schema, table);
      const tab = getTab(tabId);

      if (tab) return setActiveTabId(tabId);

      addTab({
        id: tabId,
        title: constants.getQualifiedName(schema, table),
        data: {
          type: 'table-info',
          id_connection: idConnection,
          schema,
          table,
        },
        component: () => (
          <TableInfo id_connection={idConnection} schema={schema} table={table} appTabId={tabId} />
        ),
      });
    },
    [addTab, getTab, setActiveTabId],
  );

  const openFunctionTab = React.useCallback(
    (idConnection: string, fn: IFunctionDb) => {
      const { function_schema: schema, function_name } = fn;
      const tabId = constants.getFunctionTabId(idConnection, schema, function_name);
      const tab = getTab(tabId);

      if (tab) return setActiveTabId(tabId);

      addTab({
        id: tabId,
        title: constants.getQualifiedName(schema, function_name),
        data: {
          type: 'function-info',
          id_connection: idConnection,
          schema,
          function_name,
        },
        component: () => (
          <FunctionInfo
            id_connection={idConnection}
            schema={schema}
            function_name={function_name}
          />
        ),
      });
    },
    [addTab, getTab, setActiveTabId],
  );

  const { openTabItems, openTabIds } = React.useMemo(() => {
    const items: ICentralSearchItem[] = [];

    for (const tab of tabs) {
      const data = tab.data;

      if (!data?.type) {
        continue;
      } //
      else if (data.type === 'query-editor') {
        const title = data.name;
        const idConnection = data.id_connection;

        items.push(
          constants.makeSearchItem({
            id: `open:${tab.id}`,
            tabId: tab.id,
            type: 'script',
            title,
            searchableTitle: title,
            connectionDescription: getConnectionDescription(idConnection),
            icon: 'fileSql',
            isOpen: true,
            isActive: activeTabId === tab.id,
            onOpen: () => setActiveTabId(tab.id),
          }),
        );
      } //
      else if (data.type === 'table-info') {
        const { id_connection, schema, table } = data;
        const title = constants.getQualifiedName(schema, table);

        items.push(
          constants.makeSearchItem({
            id: `open:${tab.id}`,
            tabId: tab.id,
            type: 'table',
            title,
            searchableTitle: title,
            connectionDescription: getConnectionDescription(id_connection),
            icon: 'table',
            isOpen: true,
            isActive: activeTabId === tab.id,
            onOpen: (initialWhere) => {
              if (initialWhere) {
                openTableTab(id_connection, schema, table, initialWhere);
                return;
              }

              setActiveTabId(tab.id);
            },
          }),
        );
      } //
      else if (data.type === 'function-info') {
        const { id_connection, schema, function_name } = data;
        const title = constants.getQualifiedName(schema, function_name);

        items.push(
          constants.makeSearchItem({
            id: `open:${tab.id}`,
            tabId: tab.id,
            type: 'function',
            title,
            searchableTitle: title,
            connectionDescription: getConnectionDescription(id_connection),
            icon: 'function',
            isOpen: true,
            isActive: activeTabId === tab.id,
            onOpen: () => setActiveTabId(tab.id),
          }),
        );
      }
    }

    items.sort(constants.sortByTypeThenTitle);

    const itemsList = new Set(items.map((item) => item.tabId));

    return {
      openTabItems: items,
      openTabIds: itemsList,
    };
  }, [activeTabId, getConnectionDescription, openTableTab, setActiveTabId, tabs]);

  const closedItemsByType = React.useMemo<
    Record<ICentralSearchItemType, ICentralSearchItem[]>
  >(() => {
    const openConnectionIds = new Set(Array.from(connectionsInfo.keys()));

    const closedScripts: ICentralSearchItem[] = [];
    const closedTables: ICentralSearchItem[] = [];
    const closedFunctions: ICentralSearchItem[] = [];

    for (const script of scripts) {
      const connected = openConnectionIds.has(script.id_connection);
      const opened = openTabIds.has(constants.getScriptTabId(script.id));

      if (!connected || opened) continue;

      closedScripts.push(
        constants.makeSearchItem({
          id: `script:${script.id}`,
          tabId: constants.getScriptTabId(script.id),
          type: 'script',
          title: script.name,
          searchableTitle: script.name,
          connectionDescription: getConnectionDescription(script.id_connection),
          icon: 'fileSql',
          onOpen: () => openScriptTab(script),
        }),
      );
    }

    for (const [idConnection, info] of connectionsInfo) {
      for (let index = 0; index < info?.tables?.length || 0; index++) {
        const table = info.tables[index];

        if (!table?.table_name) continue;

        const opened = openTabIds.has(
          constants.getTableTabId(idConnection, table.table_schema, table.table_name),
        );

        if (opened) continue;

        const title = constants.getQualifiedName(table.table_schema, table.table_name);

        closedTables.push(
          constants.makeSearchItem({
            id: `table:${idConnection}:${title}:${index}`,
            tabId: constants.getTableTabId(idConnection, table.table_schema, table.table_name),
            type: 'table',
            title,
            searchableTitle: title,
            connectionDescription: getConnectionDescription(idConnection),
            icon: 'table',
            onOpen: (initialWhere) =>
              openTableTab(idConnection, table.table_schema, table.table_name, initialWhere),
          }),
        );
      }
    }

    for (const [idConnection, info] of connectionsInfo) {
      for (let index = 0; index < info?.functions?.length || 0; index++) {
        const fn = info.functions[index];

        if (!fn?.function_name) continue;

        const opened = openTabIds.has(
          constants.getFunctionTabId(idConnection, fn.function_schema, fn.function_name),
        );

        if (opened) continue;

        const title = constants.getQualifiedName(fn.function_schema, fn.function_name);

        closedFunctions.push(
          constants.makeSearchItem({
            id: `function:${idConnection}:${title}:${index}`,
            tabId: constants.getFunctionTabId(idConnection, fn.function_schema, fn.function_name),
            type: 'function',
            title,
            searchableTitle: title,
            connectionDescription: getConnectionDescription(idConnection),
            icon: 'function',
            onOpen: () => openFunctionTab(idConnection, fn),
          }),
        );
      }
    }

    closedScripts.sort(constants.sortByTitle);
    closedTables.sort(constants.sortByTitle);
    closedFunctions.sort(constants.sortByTitle);

    return {
      script: closedScripts,
      table: closedTables,
      function: closedFunctions,
    };
  }, [
    connectionsInfo,
    getConnectionDescription,
    openFunctionTab,
    openScriptTab,
    openTabIds,
    openTableTab,
    scripts,
  ]);

  const { visibleItems, visibleRows } = React.useMemo(() => {
    const filter = constants.normalizeSearch(parsedSearch.filter);

    const matchItem = (item: ICentralSearchItem) => !filter || item.search.includes(filter);

    const filterAndSortItems = (items: ICentralSearchItem[]) =>
      constants.sortBySearchRelevance(items.filter(matchItem), filter);

    const filteredSections = [
      {
        title: 'Abas abertas',
        items: filterAndSortItems(openTabItems),
      },
      {
        title: 'Scripts',
        items: filterAndSortItems(closedItemsByType.script),
      },
      {
        title: 'Tabelas',
        items: filterAndSortItems(closedItemsByType.table),
      },
      {
        title: 'Funções',
        items: filterAndSortItems(closedItemsByType.function),
      },
    ].filter((section) => section.items.length);

    const rows: ICentralSearchRow[] = [];

    let itemIndex = 0;

    for (const section of filteredSections) {
      rows.push({ type: 'section', title: section.title });

      for (const item of section.items) {
        rows.push({ type: 'item', item, itemIndex });
        itemIndex += 1;
      }
    }

    const items: ICentralSearchItem[] = filteredSections.flatMap((section) => section.items);

    return {
      visibleItems: items,
      visibleRows: rows,
    };
  }, [closedItemsByType, openTabItems, parsedSearch.filter]);

  const closeModal = React.useCallback(() => {
    setIsOpen(false);
    setSearchText('');
    setHighlightedIndex(0);
  }, []);

  const runItem = React.useCallback(
    (item: ICentralSearchItem) => {
      item.onOpen(parsedSearch.argument);
      closeModal();
    },
    [closeModal, parsedSearch.argument],
  );

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isCtrlK =
        event.ctrlKey && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'k';

      if (isCtrlK) {
        event.preventDefault();
        event.stopPropagation();
        setIsOpen(true);
        return;
      }

      if (isOpen && event.key === 'Escape') {
        event.preventDefault();
        closeModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);

    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [closeModal, isOpen]);

  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [searchText, isOpen]);

  React.useEffect(() => {
    if (!visibleItems.length || highlightedIndex < visibleItems.length) return;

    setHighlightedIndex(visibleItems.length - 1);
  }, [highlightedIndex, visibleItems.length]);

  React.useEffect(() => {
    if (!isOpen) return;

    const rowIndex = visibleRows.findIndex(
      (row) => row.type === 'item' && row.itemIndex === highlightedIndex,
    );

    if (rowIndex < 0 || !resultsRef.current) return;

    const rowTop = constants.getRowOffset(visibleRows, rowIndex);
    const rowBottom = rowTop + constants.getRowSize(visibleRows[rowIndex]);
    const viewTop = resultsRef.current.scrollTop;
    const viewBottom = viewTop + resultsRef.current.clientHeight;

    if (rowTop < viewTop) {
      resultsRef.current.scrollTop = rowTop;
    } else if (rowBottom > viewBottom) {
      resultsRef.current.scrollTop = rowBottom - resultsRef.current.clientHeight;
    }
  }, [highlightedIndex, isOpen, visibleRows]);

  const style = React.useMemo(() => {
    return toCssProperties({
      backgroundColor,
      color,
      fieldBackgroundColor,
      fieldColor,
      overlayColor: __colors.overlayStrong,
      borderColor: __colors.lightGray,
      shadowColor: __colors.shadowStrong,
      subtleBackgroundColor: __colors.darkLight,
      hoverBackgroundColor: __colors.darkLightDeep,
      mutedColor: __colors.gray,
    });
  }, [
    __colors.darkLight,
    __colors.darkLightDeep,
    __colors.gray,
    __colors.lightGray,
    __colors.overlayStrong,
    __colors.shadowStrong,
    backgroundColor,
    color,
    fieldBackgroundColor,
    fieldColor,
  ]);

  if (!isOpen || !constants.containerElement) return null;

  return ReactDOM.createPortal(
    <div className={styles.overlay} onMouseDown={closeModal} style={style}>
      <div className={styles.container} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.searchHeader}>
          <input
            autoFocus
            className={styles.searchInput}
            value={searchText}
            placeholder="Buscar abas, scripts, tabelas e funções"
            onChange={(event) => setSearchText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setHighlightedIndex((prev) =>
                  visibleItems.length ? (prev + 1) % visibleItems.length : 0,
                );
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setHighlightedIndex((prev) =>
                  visibleItems.length ? (prev - 1 + visibleItems.length) % visibleItems.length : 0,
                );
              } else if (event.key === 'Enter') {
                event.preventDefault();
                const item = visibleItems[highlightedIndex];
                if (item) runItem(item);
              }
            }}
          />
          <span className={styles.shortcut}>Esc</span>
        </div>

        <div className={styles.results}>
          {visibleRows.length ? (
            <VirtualizeList
              height="100%"
              itemCount={visibleRows.length}
              itemSize={(index) => constants.getRowSize(visibleRows[index])}
              refScrollElement={resultsRef}
            >
              {({ index }) => {
                const row = visibleRows[index];

                if (row.type === 'section') {
                  return <div className={styles.sectionTitle}>{row.title}</div>;
                }

                const { item, itemIndex } = row;
                const active = itemIndex === highlightedIndex;

                return (
                  <button
                    type="button"
                    className={classes(styles.item, active && styles.itemActive)}
                    onMouseEnter={() => setHighlightedIndex(itemIndex)}
                    onClick={() => runItem(item)}
                  >
                    <span className={styles.itemIcon}>
                      <IconItemTreeView icon={item.icon} no_margin />
                    </span>

                    <span className={styles.itemBody}>
                      <span className={styles.itemTitle}>{item.title}</span>
                      <span className={styles.connection}>{item.connectionDescription}</span>
                    </span>

                    {item.isActive && <span className={styles.badge}>Atual</span>}
                    {item.isOpen && !item.isActive && <span className={styles.badge}>Aberta</span>}
                  </button>
                );
              }}
            </VirtualizeList>
          ) : (
            <div className={styles.empty}>Nenhum resultado encontrado</div>
          )}
        </div>
      </div>
    </div>,
    constants.containerElement,
  );
});

CentralSearchModal.displayName = 'CentralSearchModal';
