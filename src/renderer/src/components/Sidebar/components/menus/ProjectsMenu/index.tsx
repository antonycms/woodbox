import React from 'react';
import { Divider } from '@renderer/components/Divider';
import { Input } from '@renderer/components/Input';
import { Text } from '@renderer/components/Text';
import { Button } from '@renderer/components/Button';
import { ButtonDropdown, type IButtonDropdownOption } from '@renderer/components/ButtonDropdown';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { FileSqlIcon, OptionsIcon } from '@renderer/styles/icons';
import {
  ContextMenu,
  IContextMenuOption,
  IContextMenuPosition,
} from '@renderer/components/ContextMenu';
import TreeView, {
  IItemTreeView,
  IItemTreeViewData,
  ITreeViewRef,
} from '@renderer/components/TreeView';
import { IScript, useStoreContext } from '@renderer/contexts/Store';
import { useI18n } from '@renderer/contexts/I18n';
import { useToast } from '@renderer/contexts/Toast';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import TableInfo from '@renderer/views/TableInfo';
import FunctionInfo from '@renderer/views/FunctionInfo';
import WholeWordIcon from '@renderer/assets/icons/whole-word.svg?react';
import { useThemeContext } from '@renderer/contexts/Theme';
import { QueryEditor } from '@renderer/views/QueryEditor';
import { copyToClipboard, formatSizeFromBytes } from '@renderer/utils/methods';
import { generateHash } from '@renderer/utils/string';
import { ModalNewProject } from './components/ModalNewProject';
import { ModalNewConnection } from './components/ModalNewConnection';
import { ModalNewScript } from './components/ModalNewScript';
import { ModalDeleteTable } from './components/ModalDeleteTable';
import { ModalRenameTable } from './components/ModalRenameTable';
import { ModalImportTableData } from './components/ModalImportTableData';
import { ModalNewSchema } from './components/ModalNewSchema';
import { ModalDeleteSchema } from './components/ModalDeleteSchema';
import { ModalRenameSchema } from './components/ModalRenameSchema';
import { getRendererDialect } from '@renderer/database/dialects';
import { ModalImportProjects } from './components/ModalImportProjects';
import styles from './styles.module.css';

type SidebarRevealTarget = {
  type: 'table' | 'function';
  idConnection: string;
  schema?: string;
  name: string;
};

type SidebarRevealPath = { id: string; parentIds: string[] };

const normalizeSchema = (schema?: string | null) => schema || undefined;

const getSidebarRevealKey = (target: SidebarRevealTarget) => {
  return [target.type, target.idConnection, normalizeSchema(target.schema) || '', target.name].join(
    '\0',
  );
};

const getSidebarRevealItemKey = (item: IItemTreeView) => {
  if (item.type !== 'table' && item.type !== 'function') return;

  if (item.type === 'table') {
    if (!item.data?.id_connection || !item.data?.table_name) return;

    return getSidebarRevealKey({
      type: 'table',
      idConnection: item.data?.id_connection,
      schema: item.data?.table_schema,
      name: item.data?.table_name,
    });
  }

  if (item.type === 'function') {
    if (!item.data?.id_connection || !item.data?.function_name) return;

    return getSidebarRevealKey({
      type: 'function',
      idConnection: item.data?.id_connection,
      schema: item.data?.function_schema,
      name: item.data?.function_name,
    });
  }
};

const buildSidebarRevealIndex = (items: IItemTreeView[]) => {
  const index = new Map<string, SidebarRevealPath>();

  const addItems = (itemsToAdd: IItemTreeView[] = [], parentIds: string[] = []) => {
    for (const item of itemsToAdd) {
      if (!item) continue;

      const itemKey = getSidebarRevealItemKey(item);

      if (itemKey) {
        index.set(itemKey, { id: item.id, parentIds });
      }

      if (item.childs?.length) {
        addItems(item.childs, [...parentIds, item.id]);
      }
    }
  };

  addItems(items);

  return index;
};

const getSidebarRevealPath = (
  sidebarRevealIndex: Map<string, SidebarRevealPath>,
  target: SidebarRevealTarget,
) => {
  return sidebarRevealIndex.get(getSidebarRevealKey(target));
};

const scheduleSidebarReveal = (callback: () => void) => {
  let secondFrameId: number | undefined;

  const firstFrameId = window.requestAnimationFrame(() => {
    secondFrameId = window.requestAnimationFrame(callback);
  });

  return () => {
    window.cancelAnimationFrame(firstFrameId);
    if (secondFrameId) window.cancelAnimationFrame(secondFrameId);
  };
};

const ProjectsMenu = () => {
  const {
    activeTheme: { sideBar: colors },
  } = useThemeContext();

  const {
    connectionsGroupPerProject,
    removeConnection,
    removeProject,
    removeScript,
    loadConnectionInfo,
    closeConnection,
    connectionsInfo,
    scripts,
  } = useStoreContext();

  const { showToast } = useToast();
  const { t } = useI18n();
  const { tabs, addTab, removeTab, getTab, activeTabId, setActiveTabId } = useAppTabContext();
  const treeViewRef = React.useRef<ITreeViewRef>(null);
  const lastRevealKeyRef = React.useRef('');
  const [loadingConnectionsId, setLoadingConnectionsId] = React.useState<string[]>([]);

  const [filterText, setFilterText] = React.useState('');
  const [isWholeWordFilter, setIsWholeWordFilter] = React.useState(false);

  const [contextMenuPosition, setContextMenuPosition] = React.useState<IContextMenuPosition>();
  const [contextMenuItemSelected, setContextMenuItemSelected] = React.useState<IItemTreeViewData>();

  const [idProjectSelected, setIdProjectSelected] = React.useState<string>();
  const [idConnectionSelected, setIdConnectionSelected] = React.useState<string>();

  const [isNewProject, setIsNewProject] = React.useState(false);
  const [projectEditing, setProjectEditing] = React.useState<IItemTreeViewData>();
  const [showImportProjects, setShowImportProjects] = React.useState(false);

  const [isNewConnection, setIsNewConnection] = React.useState(false);
  const [connectionEditing, setConnectionEditing] = React.useState<IItemTreeViewData>();

  const [isNewScript, setIsNewScript] = React.useState(false);
  const [scriptEditing, setScriptEditing] = React.useState<IScript>();

  const [schemaToCreate, setSchemaToCreate] = React.useState<IItemTreeViewData>();
  const [schemaToDelete, setSchemaToDelete] = React.useState<IItemTreeViewData>();
  const [schemaToRename, setSchemaToRename] = React.useState<IItemTreeViewData>();
  const [tableToDelete, setTableToDelete] = React.useState<IItemTreeViewData>();
  const [tableToRename, setTableToRename] = React.useState<IItemTreeViewData>();
  const [tableToImport, setTableToImport] = React.useState<IItemTreeViewData>();

  const showModalNewProject = !!(isNewProject || projectEditing);
  const showModalNewConnection = !!(isNewConnection || connectionEditing);
  const showModalNewScript = !!(isNewScript || scriptEditing);

  const filterTextSerialized = filterText?.trim?.() ?? '';

  const scriptsByConnectionId = React.useMemo(() => {
    const grouped = new Map<string, IScript[]>();

    scripts.forEach((script) => {
      const connectionScripts = grouped.get(script.id_connection) || [];
      connectionScripts.push(script);
      grouped.set(script.id_connection, connectionScripts);
    });

    return grouped;
  }, [scripts]);

  const loadingConnectionsIdSet = React.useMemo(() => {
    return new Set(loadingConnectionsId);
  }, [loadingConnectionsId]);

  const checkFilterText = React.useCallback((text: string, text2?: string) => {
    const filterWithSchema = filterTextSerialized.includes('.');

    if (isWholeWordFilter) {
      return filterWithSchema
        ? `${text2}.${text}`.trim() === filterTextSerialized
        : text === filterTextSerialized;
    }

    return filterWithSchema
      ? filterTextSerialized.startsWith(text2) &&
          `${text2}.${text}`.trim().includes(filterTextSerialized)
      : text?.includes?.(filterTextSerialized);
  }, [filterTextSerialized, isWholeWordFilter]);

  const checkHasConnection = React.useCallback(
    (id?: string) => {
      return !!id && connectionsInfo.has(id);
    },
    [connectionsInfo],
  );

  const refreshConnectionInfo = React.useCallback(async (id?: string, force?: boolean) => {
    if (!id) return false;

    const hasInfo = connectionsInfo.get(id);

    if (hasInfo && !force) return;

    setLoadingConnectionsId((prevState) => [...prevState, id]);

    try {
      await loadConnectionInfo(id);
    } catch (error) {
      showToast({
        type: 'error',
        title: t('toast.connectionError'),
        description: error.message,
      });

      return false;
    } finally {
      setLoadingConnectionsId((prevState) =>
        prevState.filter((idConnection) => idConnection !== id),
      );
    }
  }, [connectionsInfo, loadConnectionInfo, showToast, t]);

  const onContextMenuTreeView = React.useCallback(
    (item: IItemTreeViewData, event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const position = { x: event.clientX, y: event.clientY };

      setContextMenuPosition(position);
      setContextMenuItemSelected((prevState) => (item?.id === prevState?.id ? prevState : item));
    },
    [],
  );

  const onCloseModalProject = React.useCallback(() => {
    setIsNewProject(false);
    setProjectEditing(null);
  }, []);

  const onCloseModalConnection = React.useCallback(() => {
    setIsNewConnection(false);
    setConnectionEditing(null);
  }, []);

  const onCloseModalScript = React.useCallback(() => {
    setIsNewScript(false);
    setScriptEditing(null);
  }, []);

  const closeNewSchemaModal = React.useCallback(() => {
    setSchemaToCreate(null);
  }, []);

  const closeDeleteSchemaModal = React.useCallback(() => {
    setSchemaToDelete(null);
  }, []);

  const closeRenameSchemaModal = React.useCallback(() => {
    setSchemaToRename(null);
  }, []);

  const closeDeleteTableModal = React.useCallback(() => {
    setTableToDelete(null);
  }, []);

  const closeRenameTableModal = React.useCallback(() => {
    setTableToRename(null);
  }, []);

  const closeImportTableModal = React.useCallback(() => {
    setTableToImport(null);
  }, []);

  const removeTabsFromConnections = React.useCallback(
    (connectionIds: string[]) => {
      if (!connectionIds.length) return;

      const connectionIdSet = new Set(connectionIds);
      const tabsToRemove = tabs
        .filter((tab) => {
          if (
            tab.data &&
            'id_connection' in tab.data &&
            connectionIdSet.has(tab.data.id_connection)
          ) {
            return true;
          }

          return connectionIds.some((connectionId) =>
            tab.id.startsWith(`new_table_${connectionId}_`),
          );
        })
        .map((tab) => tab.id);

      if (tabsToRemove.length) {
        removeTab(tabsToRemove, { keepHistory: false });
      }
    },
    [removeTab, tabs],
  );

  const handleRemoveProject = React.useCallback(
    async (id?: string) => {
      if (!id) return;

      const connectionIds =
        connectionsGroupPerProject
          .find((project) => project.id === id)
          ?.connections.map((connection) => connection.id) || [];

      await removeProject(id);
      removeTabsFromConnections(connectionIds);
    },
    [connectionsGroupPerProject, removeProject, removeTabsFromConnections],
  );

  const handleRemoveConnection = React.useCallback(
    async (id?: string) => {
      if (!id) return;

      await removeConnection(id);
      removeTabsFromConnections([id]);
    },
    [removeConnection, removeTabsFromConnections],
  );

  const handleOpemItemTreeView = React.useCallback(
    async (item: IItemTreeViewData, itemIsOpen: boolean) => {
      if (itemIsOpen) return;

      if (item.type === 'connection') {
        const success = await refreshConnectionInfo(item.id);
        return success;
      }
    },
    [refreshConnectionInfo],
  );

  const handleClickItemThreeView = React.useCallback((item: IItemTreeViewData) => {
    setIdConnectionSelected(item?.data?.id_connection);
    setIdProjectSelected(item?.data?.id_project);
  }, []);

  const openTabScriptSql = React.useCallback((script: IScript) => {
    const tabId = `script_${script.id}`;

    const tab = getTab(tabId);

    if (tab) return setActiveTabId(tabId);

    refreshConnectionInfo(script.id_connection);

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
  }, [addTab, getTab, refreshConnectionInfo, setActiveTabId]);

  const openSelectedConnectionScript = React.useCallback(() => {
    if (!idConnectionSelected) return;

    const connectionScripts = scriptsByConnectionId.get(idConnectionSelected) || [];
    const script = connectionScripts[connectionScripts.length - 1];

    script ? openTabScriptSql(script) : setIsNewScript(true);
  }, [idConnectionSelected, openTabScriptSql, scriptsByConnectionId]);

  const handleDoubleClickItemThreeView = React.useCallback((item: IItemTreeViewData) => {
    if (item.type === 'table') {
      const { id_connection, table_schema: schema, table_name: table } = item.data;
      const tabId = `${id_connection}_${schema}_${table}`;
      const title = `${schema ? `${schema}.` : ''}${table}`;

      const tab = getTab(tabId);

      if (tab) {
        setActiveTabId(tabId);
      } else {
        addTab({
          id: tabId,
          title,
          data: {
            type: 'table-info',
            id_connection,
            schema,
            table,
          },
          component: () => (
            <TableInfo
              id_connection={id_connection}
              schema={schema}
              table={table}
              appTabId={tabId}
            />
          ),
        });
      }
    } else if (item.type === 'function') {
      const { id_connection, function_schema: schema, function_name } = item.data;
      const tabId = `fn_${id_connection}_${schema}_${function_name}`;

      const tab = getTab(tabId);

      if (tab) {
        setActiveTabId(tabId);
      } else {
        addTab({
          id: tabId,
          title: `${schema ? `${schema}.` : ''}${function_name}`,
          data: {
            type: 'function-info',
            id_connection,
            schema,
            function_name,
          },
          component: () => (
            <FunctionInfo
              id_connection={id_connection}
              schema={schema}
              function_name={function_name}
            />
          ),
        });
      }
    } else if (item.type === 'script') {
      const { script } = item.data;
      openTabScriptSql(script);
    }
  }, [addTab, getTab, openTabScriptSql, setActiveTabId]);

  const contextOptions = React.useMemo(() => {
    const optionsAvailable: Record<string, IContextMenuOption[]> = {
      project: [
        {
          text: t('context.newConnection'),
          onClick: () => setIsNewConnection(true),
        },
        {
          text: t('context.editProject'),
          onClick: () => setProjectEditing(contextMenuItemSelected),
        },
        {
          text: t('context.deleteProject'),
          onClick: () => handleRemoveProject(contextMenuItemSelected?.id),
        },
      ],

      connection: [
        !checkHasConnection(contextMenuItemSelected?.id) && {
          text: t('context.connect'),
          onClick: () => refreshConnectionInfo(contextMenuItemSelected?.id),
        },
        checkHasConnection(contextMenuItemSelected?.id) && {
          text: t('context.disconnect'),
          onClick: async () => {
            await closeConnection(contextMenuItemSelected?.id);
            await treeViewRef.current?.switch(contextMenuItemSelected?.id, false);
          },
        },
        checkHasConnection(contextMenuItemSelected?.id) && {
          text: t('context.reload'),
          onClick: () => refreshConnectionInfo(contextMenuItemSelected?.id, true),
        },
        {
          text: t('context.editConnection'),
          onClick: () => setConnectionEditing(contextMenuItemSelected),
        },
        {
          text: t('context.deleteConnection'),
          onClick: () => handleRemoveConnection(contextMenuItemSelected?.id),
        },
      ],

      schemas: [
        {
          text: t('context.createSchema'),
          onClick: () => setSchemaToCreate(contextMenuItemSelected),
        },
      ],

      schema: [
        {
          text: t('common.copy'),
          onClick: () => copyToClipboard(contextMenuItemSelected.data.schema_name),
        },
        {
          text: t('modal.renameSchema'),
          onClick: () => setSchemaToRename(contextMenuItemSelected),
        },
        {
          text: t('context.deleteSchemaAlt'),
          onClick: () => setSchemaToDelete(contextMenuItemSelected),
        },
      ],

      table: [
        {
          text: t('common.copy'),
          onClick: () => {
            const data = contextMenuItemSelected?.data;
            copyToClipboard([data.table_schema, data.table_name].filter(Boolean).join('.'));
          },
        },
        {
          text: t('modal.importData'),
          onClick: () => setTableToImport(contextMenuItemSelected),
        },
        {
          text: t('modal.renameTable'),
          onClick: () => setTableToRename(contextMenuItemSelected),
        },
        {
          text: t('modal.deleteTable'),
          onClick: () => setTableToDelete(contextMenuItemSelected),
        },
      ],

      tables: [
        {
          text: t('context.createTable'),
          onClick: () => {
            const { id_connection, schema_name } = contextMenuItemSelected?.data || {};
            if (!id_connection) return;

            const tabId = `new_table_${id_connection}_${schema_name || 'public'}_${generateHash()}`;

            addTab({
              id: tabId,
              title: t('modal.newTable'),
              unsaved: true,
              component: () => (
                <TableInfo
                  id_connection={id_connection}
                  schema={schema_name}
                  table=""
                  appTabId={tabId}
                  mode="create"
                  draftTabId={tabId}
                />
              ),
            });
          },
        },
      ],

      scripts: [
        {
          text: t('context.newSqlScript'),
          onClick: () => setIsNewScript(true),
        },
      ],

      script: [
        {
          text: t('context.renameScript'),
          onClick: () => setScriptEditing(contextMenuItemSelected?.data?.script),
        },
        {
          text: t('context.deleteScript'),
          onClick: () => {
            const id_script = contextMenuItemSelected?.data?.script?.id;
            const tabId = `script_${id_script}`;

            removeTab(tabId);
            removeScript(id_script);
          },
        },
      ],
    };

    return optionsAvailable[contextMenuItemSelected?.type] || [];
  }, [
    addTab,
    checkHasConnection,
    closeConnection,
    contextMenuItemSelected,
    handleRemoveConnection,
    handleRemoveProject,
    refreshConnectionInfo,
    removeScript,
    removeTab,
    t,
  ]);

  const projectsSerialized = React.useMemo(() => {
    return connectionsGroupPerProject.map((project) => {
      let hasContentWithFilterText = false;

      const projects: IItemTreeView = {
        id: project.id,
        label: project.description,
        type: 'project' as const,
        icon: 'grid',
        data: { id_project: project.id },
        childs: project.connections.map((connection) => {
          const connectionInfo = connectionsInfo.get(connection.id);
          const dialect = getRendererDialect(connection.dialect);

          const dataConnection = {
            id_project: project.id,
            id_connection: connection.id,
            description_connection: connection.description,
          };

          let tablesThreeView: IItemTreeView[] =
            connectionInfo?.tables?.map((table) => {
              const { table_name, table_schema, total_size } = table;

              return {
                id: table_schema
                  ? `${connection.id}:${table_schema}_${table_name}`
                  : `${connection.id}:${table_name}`,
                label: table_name,
                labelInfo: formatSizeFromBytes(total_size),
                icon: 'table' as const,
                type: 'table' as const,
                data: { ...table, ...dataConnection },
              };
            }) || [];

          let functionsThreeView: IItemTreeView[] = dialect.supportsFunctions
            ? connectionInfo?.functions?.map((fn, index) => {
                const { function_name, function_schema } = fn;

                return {
                  id: function_schema
                    ? `${connection.id}:${function_schema}_${function_name}:${index}`
                    : `${connection.id}:${function_name}:${index}`,
                  label: function_name,
                  icon: 'function',
                  type: 'function',
                  data: { ...fn, ...dataConnection },
                };
              }) || []
            : [];

          const connectionScripts = scriptsByConnectionId.get(connection.id) || [];

          const scriptsThreeView: IItemTreeView[] = connectionScripts.map((script) => ({
            id: `script_${script.id}`,
            label: script.name,
            icon: 'file' as const,
            type: 'script' as const,
            data: { script, ...dataConnection },
          }));

          if (filterTextSerialized) {
            tablesThreeView = tablesThreeView.filter((table) =>
              checkFilterText(table?.label, table?.data?.table_schema),
            );
            functionsThreeView = functionsThreeView.filter((fn) =>
              checkFilterText(fn?.label, fn?.data?.function_schema),
            );
          }

          let schemasThreeView: IItemTreeView[] = dialect.supportsSchemas
            ? connectionInfo?.schemas?.map?.((schema) => {
                const tablesSchema = tablesThreeView.filter(
                  ({ data }) => data.table_schema === schema,
                );
                const functionsSchema = functionsThreeView.filter(
                  ({ data }) => data.function_schema === schema,
                );

                return {
                  id: `${connection.id}:${schema}`,
                  label: schema,
                  data: { schema_name: schema, ...dataConnection },
                  icon: 'folder' as const,
                  type: 'schema' as const,
                  childs: [
                    {
                      id: `tables_${connection.id}:${schema}`,
                      label: t('tabs.tables'),
                      icon: 'multi',
                      childs: tablesSchema,
                      type: 'tables' as const,
                      data: { schema_name: schema, ...dataConnection },
                    },
                    {
                      id: `fns_${connection.id}:${schema}`,
                      label: t('tabs.functions'),
                      childs: functionsSchema,
                      icon: 'functions',
                    },
                  ],
                };
              }) || []
            : [];

          if (filterTextSerialized) {
            schemasThreeView = schemasThreeView.filter((schema) =>
              schema.childs.some((group) => group.childs?.length),
            );
          }

          hasContentWithFilterText =
            hasContentWithFilterText || !!tablesThreeView.length || !!functionsThreeView.length;

          return {
            id: connection.id,
            label: connection.description,
            labelInfo:
              dialect.connectionMode === 'file'
                ? connection.database
                : `${connection.host}:${connection.port}`,
            loading: loadingConnectionsIdSet.has(connection.id),
            icon: 'database' as const,
            type: 'connection' as const,
            data: { id_connection: connection.id, description_connection: connection.description },
            childs: [
              dialect.supportsSchemas && {
                id: `schemas_${connection.id}`,
                type: 'schemas',
                label: t('sidebar.schemas'),
                childs: schemasThreeView,
                icon: 'schema',
                data: dataConnection,
              },
              !dialect.supportsSchemas && {
                id: `tables_${connection.id}`,
                type: 'tables',
                label: t('tabs.tables'),
                childs: tablesThreeView,
                data: dataConnection,
              },
              {
                id: `scripts_${connection.id}`,
                type: 'scripts',
                label: t('tabs.scripts'),
                childs: scriptsThreeView,
                icon: 'fileSql',
                data: dataConnection,
              },
            ].filter(Boolean),
          } as IItemTreeView;
        }),
      };

      return { ...projects, hasContentWithFilterText };
    });
  }, [
    checkFilterText,
    connectionsGroupPerProject,
    connectionsInfo,
    filterTextSerialized,
    loadingConnectionsIdSet,
    scriptsByConnectionId,
    t,
  ]);

  const sidebarRevealIndex = React.useMemo(() => {
    return buildSidebarRevealIndex(projectsSerialized);
  }, [projectsSerialized]);

  const treeViewItems = React.useMemo(() => {
    return filterTextSerialized
      ? projectsSerialized.filter((project) => project.hasContentWithFilterText)
      : projectsSerialized;
  }, [filterTextSerialized, projectsSerialized]);

  const activeSidebarRevealTarget = React.useMemo<SidebarRevealTarget | undefined>(() => {
    const tab = tabs.find((item) => item.id === activeTabId);
    const data = tab?.data;

    if (data?.type === 'table-info') {
      return {
        type: 'table',
        idConnection: data.id_connection,
        schema: data.schema,
        name: data.table,
      };
    }

    if (data?.type === 'function-info') {
      return {
        type: 'function',
        idConnection: data.id_connection,
        schema: data.schema,
        name: data.function_name,
      };
    }
  }, [activeTabId, tabs]);

  React.useEffect(() => {
    if (!activeSidebarRevealTarget) {
      lastRevealKeyRef.current = '';
      return;
    }

    const revealPath = getSidebarRevealPath(sidebarRevealIndex, activeSidebarRevealTarget);

    if (!revealPath) {
      lastRevealKeyRef.current = '';
      return;
    }

    const revealKey = [activeTabId, revealPath.id, ...revealPath.parentIds].join('|');

    if (lastRevealKeyRef.current === revealKey) return;

    lastRevealKeyRef.current = revealKey;

    return scheduleSidebarReveal(() => {
      treeViewRef.current?.reveal(revealPath.id, revealPath.parentIds, { focus: false });
    });
  }, [activeSidebarRevealTarget, activeTabId, sidebarRevealIndex]);

  const closeContextMenu = React.useCallback(() => {
    setContextMenuItemSelected(null);
  }, []);

  const openNewProject = React.useCallback(() => {
    setIsNewProject(true);
  }, []);

  const closeImportProjectsModal = React.useCallback(() => {
    setShowImportProjects(false);
  }, []);

  const projectOptions = React.useMemo(
    () => [
      { id: 'add', label: t('project.add') },
      { id: 'import-projects', label: t('project.import') },
    ],
    [t],
  );

  const handleSelectProjectOption = React.useCallback(
    (option: IButtonDropdownOption) => {
      if (option.id === 'add') openNewProject();
      if (option.id === 'import-projects') setShowImportProjects(true);
    },
    [openNewProject],
  );

  const toggleWholeWordFilter = React.useCallback(() => {
    setIsWholeWordFilter((prevState) => !prevState);
  }, []);

  return (
    <>
      <ModalNewProject
        show={showModalNewProject}
        onClose={onCloseModalProject}
        idProject={projectEditing?.id}
      />

      <ModalNewConnection
        show={showModalNewConnection}
        onClose={onCloseModalConnection}
        idProject={idProjectSelected}
        idConnection={connectionEditing?.id}
      />

      <ModalNewScript
        show={showModalNewScript}
        onClose={onCloseModalScript}
        idConnection={idConnectionSelected}
        idScript={scriptEditing?.id}
        onNewScriptCreated={openTabScriptSql}
      />

      <ModalNewSchema
        show={!!schemaToCreate}
        idConnection={schemaToCreate?.data?.id_connection}
        onClose={closeNewSchemaModal}
      />

      <ModalDeleteSchema
        show={!!schemaToDelete}
        idConnection={schemaToDelete?.data?.id_connection}
        schema={schemaToDelete?.data?.schema_name}
        onClose={closeDeleteSchemaModal}
      />

      <ModalRenameSchema
        show={!!schemaToRename}
        idConnection={schemaToRename?.data?.id_connection}
        schema={schemaToRename?.data?.schema_name}
        onClose={closeRenameSchemaModal}
      />

      <ModalDeleteTable
        show={!!tableToDelete}
        idConnection={tableToDelete?.data?.id_connection}
        schema={tableToDelete?.data?.table_schema}
        table={tableToDelete?.data?.table_name}
        onClose={closeDeleteTableModal}
      />

      <ModalRenameTable
        show={!!tableToRename}
        idConnection={tableToRename?.data?.id_connection}
        schema={tableToRename?.data?.table_schema}
        table={tableToRename?.data?.table_name}
        onClose={closeRenameTableModal}
      />

      <ModalImportTableData
        show={!!tableToImport}
        idConnection={tableToImport?.data?.id_connection}
        schema={tableToImport?.data?.table_schema}
        table={tableToImport?.data?.table_name}
        onClose={closeImportTableModal}
      />

      <ModalImportProjects show={showImportProjects} onClose={closeImportProjectsModal} />

      <Row>
        <Text bold color={colors.color} userSelect={false}>
          {t('sidebar.projects')}
        </Text>

        <Spacer />

        {!!idConnectionSelected && (
          <Button
            smallIcon
            text
            title="Abrir editor SQL"
            color={colors.color}
            icon={() => <FileSqlIcon size={14} />}
            onClick={openSelectedConnectionScript}
          />
        )}

        <ButtonDropdown
          smallIcon
          text
          title={t('project.options')}
          color={colors.color}
          icon={() => <OptionsIcon size={18} />}
          options={projectOptions}
          onSelect={handleSelectProjectOption}
          align="right"
          dropdownBackground={colors.cardBackgroundColor || colors.fieldBackgroundColor}
          dropdownColor={colors.color}
          dropdownHoverBackground={colors.selectedBackgroundColor}
        />
      </Row>

      <Divider />

      <Input
        id="input_filter_projects"
        placeholder={t('common.filter')}
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        color={colors.fieldColor}
        backgroundColor={colors.fieldBackgroundColor}
        placeholderColor={colors.fieldPlaceholderColor}
        icon={() => (
          <Button
            smallIcon
            text
            title="Palavra exata"
            icon={() => <WholeWordIcon />}
            color={isWholeWordFilter ? 'white' : 'gray'}
            onClick={toggleWholeWordFilter}
          />
        )}
      />

      <Divider />

      <div className={styles.containerTreeViewProjects}>
        {!treeViewItems.length && (
          <Text small color={colors.color} userSelect={false}>
            {t('project.empty')}
          </Text>
        )}

        {!!treeViewItems.length && (
          <TreeView
            ref={treeViewRef}
            onContextMenu={onContextMenuTreeView}
            onSwitchItem={handleOpemItemTreeView}
            onDoubleClick={handleDoubleClickItemThreeView}
            onClick={handleClickItemThreeView}
            items={treeViewItems}
          />
        )}

        <ContextMenu
          position={contextMenuPosition}
          options={contextOptions}
          onClose={closeContextMenu}
        />
      </div>
    </>
  );
};

export default React.memo(ProjectsMenu);
