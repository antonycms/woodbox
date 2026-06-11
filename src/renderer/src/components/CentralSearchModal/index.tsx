import React from 'react';
import ReactDOM from 'react-dom';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import { useStoreContext, type IFunctionDb, type IScript } from '@renderer/contexts/Store';
import { QueryEditor } from '@renderer/views/QueryEditor';
import TableInfo from '@renderer/views/TableInfo';
import FunctionInfo from '@renderer/views/FunctionInfo';
import IconItemTreeView from '@renderer/components/TreeView/IconItemTreeView';
import type { AvalailableTreeViewIcon } from '@renderer/components/TreeView/IconItemTreeView';
import { VirtualizeList } from '@renderer/components/VirtualizeList';
import { classes, toCssProperties } from '@renderer/styles/theme';
import { useThemeContext } from '@renderer/contexts/Theme';
import styles from './styles.module.css';

const containerElement = document.getElementById('modal-root');
const SECTION_ROW_HEIGHT = 33;
const ITEM_ROW_HEIGHT = 52;
const ITEM_TYPE_ORDER: Record<ICentralSearchItemType, number> = {
  script: 0,
  table: 1,
  function: 2,
};

export const CentralSearchModal = React.memo(() => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchText, setSearchText] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  const { tabs, addTab, getTab, activeTabId, setActiveTabId } = useAppTabContext();
  const { scripts, connections, connectionsInfo } = useStoreContext();
  const {
    activeTheme: {
      modal: { backgroundColor, color, fieldBackgroundColor, fieldColor },
    },
  } = useThemeContext();

  const connectionById = React.useMemo(() => {
    return new Map(connections.map((connection) => [connection.id, connection]));
  }, [connections]);

  const openConnectionIds = React.useMemo(() => {
    return new Set(Array.from(connectionsInfo.keys()));
  }, [connectionsInfo]);

  const getConnectionDescription = React.useCallback(
    (idConnection: string) => connectionById.get(idConnection)?.description || idConnection,
    [connectionById],
  );

  const openScriptTab = React.useCallback(
    (script: IScript) => {
      const tabId = getScriptTabId(script.id);
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
          title: `${getQualifiedName(schema, table)} [${initialWhere}]`,
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

      const tabId = getTableTabId(idConnection, schema, table);
      const tab = getTab(tabId);

      if (tab) return setActiveTabId(tabId);

      addTab({
        id: tabId,
        title: getQualifiedName(schema, table),
        data: {
          type: 'table-info',
          id_connection: idConnection,
          schema,
          table,
        },
        component: () => <TableInfo id_connection={idConnection} schema={schema} table={table} />,
      });
    },
    [addTab, getTab, setActiveTabId],
  );

  const openFunctionTab = React.useCallback(
    (idConnection: string, fn: IFunctionDb) => {
      const { function_schema: schema, function_name } = fn;
      const tabId = getFunctionTabId(idConnection, schema, function_name);
      const tab = getTab(tabId);

      if (tab) return setActiveTabId(tabId);

      addTab({
        id: tabId,
        title: getQualifiedName(schema, function_name),
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

  const openTabItems = React.useMemo<ICentralSearchItem[]>(() => {
    return tabs
      .map((tab) => {
        const data = tab.data;

        if (data?.type === 'query-editor') {
          const script = scripts.find((item) => item.id === data.id_script);
          const title = script?.name || tab.title;
          const idConnection = data.id_connection;

          return makeSearchItem({
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
          });
        }

        if (data?.type === 'table-info') {
          const { id_connection, schema, table } = data;
          const title = getQualifiedName(schema, table);

          return makeSearchItem({
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
          });
        }

        if (data?.type === 'function-info') {
          const { id_connection, schema, function_name } = data;
          const title = getQualifiedName(schema, function_name);

          return makeSearchItem({
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
          });
        }
      })
      .filter(Boolean)
      .sort(sortByTypeThenTitle);
  }, [activeTabId, getConnectionDescription, openTableTab, scripts, setActiveTabId, tabs]);

  const openTabIds = React.useMemo(() => {
    return new Set(openTabItems.map((item) => item.tabId));
  }, [openTabItems]);

  const closedItemsByType = React.useMemo<
    Record<ICentralSearchItemType, ICentralSearchItem[]>
  >(() => {
    const closedScripts = scripts
      .filter((script) => openConnectionIds.has(script.id_connection))
      .filter((script) => !openTabIds.has(getScriptTabId(script.id)))
      .map((script) =>
        makeSearchItem({
          id: `script:${script.id}`,
          tabId: getScriptTabId(script.id),
          type: 'script',
          title: script.name,
          searchableTitle: script.name,
          connectionDescription: getConnectionDescription(script.id_connection),
          icon: 'fileSql',
          onOpen: () => openScriptTab(script),
        }),
      )
      .sort(sortByTitle);

    const closedTables = Array.from(connectionsInfo.entries())
      .flatMap(([idConnection, info]) => {
        return (info.tables || [])
          .filter(
            (table) =>
              !openTabIds.has(getTableTabId(idConnection, table.table_schema, table.table_name)),
          )
          .map((table, index) => {
            const title = getQualifiedName(table.table_schema, table.table_name);

            return makeSearchItem({
              id: `table:${idConnection}:${title}:${index}`,
              tabId: getTableTabId(idConnection, table.table_schema, table.table_name),
              type: 'table',
              title,
              searchableTitle: title,
              connectionDescription: getConnectionDescription(idConnection),
              icon: 'table',
              onOpen: (initialWhere) =>
                openTableTab(idConnection, table.table_schema, table.table_name, initialWhere),
            });
          });
      })
      .sort(sortByTitle);

    const closedFunctions = Array.from(connectionsInfo.entries())
      .flatMap(([idConnection, info]) => {
        return (info.functions || [])
          .filter(
            (fn) =>
              !openTabIds.has(getFunctionTabId(idConnection, fn.function_schema, fn.function_name)),
          )
          .map((fn, index) => {
            const title = getQualifiedName(fn.function_schema, fn.function_name);

            return makeSearchItem({
              id: `function:${idConnection}:${title}:${index}`,
              tabId: getFunctionTabId(idConnection, fn.function_schema, fn.function_name),
              type: 'function',
              title,
              searchableTitle: title,
              connectionDescription: getConnectionDescription(idConnection),
              icon: 'function',
              onOpen: () => openFunctionTab(idConnection, fn),
            });
          });
      })
      .sort(sortByTitle);

    return {
      script: closedScripts,
      table: closedTables,
      function: closedFunctions,
    };
  }, [
    connectionsInfo,
    getConnectionDescription,
    openConnectionIds,
    openFunctionTab,
    openScriptTab,
    openTabIds,
    openTableTab,
    scripts,
  ]);

  const parsedSearch = React.useMemo(() => parseSearchText(searchText), [searchText]);

  const filteredSections = React.useMemo(() => {
    const filter = normalizeSearch(parsedSearch.filter);
    const matchItem = (item: ICentralSearchItem) => !filter || item.search.includes(filter);
    const filterAndSortItems = (items: ICentralSearchItem[]) =>
      sortBySearchRelevance(items.filter(matchItem), filter);

    return [
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
  }, [closedItemsByType, openTabItems, parsedSearch.filter]);

  const visibleItems = React.useMemo(
    () => filteredSections.flatMap((section) => section.items),
    [filteredSections],
  );

  const visibleRows = React.useMemo<ICentralSearchRow[]>(() => {
    let itemIndex = 0;

    return filteredSections.flatMap((section) => {
      const rows: ICentralSearchRow[] = [{ type: 'section', title: section.title }];

      section.items.forEach((item) => {
        rows.push({ type: 'item', item, itemIndex });
        itemIndex += 1;
      });

      return rows;
    });
  }, [filteredSections]);

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
    if (!isOpen) return;

    const timer = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

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

    const rowTop = getRowOffset(visibleRows, rowIndex);
    const rowBottom = rowTop + getRowSize(visibleRows[rowIndex]);
    const viewTop = resultsRef.current.scrollTop;
    const viewBottom = viewTop + resultsRef.current.clientHeight;

    if (rowTop < viewTop) {
      resultsRef.current.scrollTop = rowTop;
    } else if (rowBottom > viewBottom) {
      resultsRef.current.scrollTop = rowBottom - resultsRef.current.clientHeight;
    }
  }, [highlightedIndex, isOpen, visibleRows]);

  const style = React.useMemo(() => {
    return toCssProperties({ backgroundColor, color, fieldBackgroundColor, fieldColor });
  }, [backgroundColor, color, fieldBackgroundColor, fieldColor]);

  if (!isOpen || !containerElement) return null;

  return ReactDOM.createPortal(
    <div className={styles.overlay} onMouseDown={closeModal} style={style}>
      <div className={styles.container} onMouseDown={(event) => event.stopPropagation()}>
        <div className={styles.searchHeader}>
          <input
            ref={inputRef}
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
          {filteredSections.length ? (
            <VirtualizeList
              height="100%"
              itemCount={visibleRows.length}
              itemSize={(index) => getRowSize(visibleRows[index])}
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
    containerElement,
  );
});

CentralSearchModal.displayName = 'CentralSearchModal';

function getScriptTabId(idScript: string) {
  return `script_${idScript}`;
}

function getTableTabId(idConnection: string, schema: string | undefined, table: string) {
  return `${idConnection}_${schema}_${table}`;
}

function getFunctionTabId(idConnection: string, schema: string | undefined, functionName: string) {
  return `fn_${idConnection}_${schema}_${functionName}`;
}

function getQualifiedName(schema: string | undefined, name: string) {
  return schema ? `${schema}.${name}` : name;
}

function normalizeSearch(value: string) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function parseSearchText(value: string): IParsedSearch {
  const match = value.trim().match(/^(\S+)(?:\s+([\s\S]+))?$/);

  return {
    filter: match?.[1] || '',
    argument: match?.[2]?.trim(),
  };
}

function makeSearchItem(item: Omit<ICentralSearchItem, 'search'>): ICentralSearchItem {
  return {
    ...item,
    search: normalizeSearch(`${item.searchableTitle} ${item.connectionDescription}`),
  };
}

function sortByTitle(a: ICentralSearchItem, b: ICentralSearchItem) {
  return a.title.localeCompare(b.title);
}

function sortByTypeThenTitle(a: ICentralSearchItem, b: ICentralSearchItem) {
  return ITEM_TYPE_ORDER[a.type] - ITEM_TYPE_ORDER[b.type] || sortByTitle(a, b);
}

function sortBySearchRelevance(items: ICentralSearchItem[], filter: string) {
  if (!filter) return items;

  return [...items].sort((a, b) => {
    const rankA = getSearchRank(a, filter);
    const rankB = getSearchRank(b, filter);

    return rankA - rankB || sortByTitle(a, b);
  });
}

function getSearchRank(item: ICentralSearchItem, filter: string) {
  const title = normalizeSearch(item.searchableTitle);
  const objectName = title.split('.').pop() || title;
  const connection = normalizeSearch(item.connectionDescription);

  if (objectName === filter) return 0;
  if (objectName.startsWith(filter)) return 1;
  if (title === filter) return 2;
  if (title.startsWith(filter)) return 3;
  if (objectName.includes(filter)) return 4;
  if (title.includes(filter)) return 5;
  if (connection.startsWith(filter)) return 6;

  return 7;
}

function getRowSize(row: ICentralSearchRow) {
  return row.type === 'section' ? SECTION_ROW_HEIGHT : ITEM_ROW_HEIGHT;
}

function getRowOffset(rows: ICentralSearchRow[], indexTarget: number) {
  let offset = 0;

  for (let index = 0; index < indexTarget; index++) {
    offset += getRowSize(rows[index]);
  }

  return offset;
}

type ICentralSearchItemType = 'script' | 'table' | 'function';

interface IParsedSearch {
  filter: string;
  argument?: string;
}

type ICentralSearchRow =
  | { type: 'section'; title: string }
  | { type: 'item'; item: ICentralSearchItem; itemIndex: number };

interface ICentralSearchItem {
  id: string;
  tabId: string;
  type: ICentralSearchItemType;
  title: string;
  searchableTitle: string;
  search: string;
  connectionDescription: string;
  icon: AvalailableTreeViewIcon;
  isOpen?: boolean;
  isActive?: boolean;
  onOpen(argument?: string): void;
}
