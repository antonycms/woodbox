import type { ProjectTreeItemData } from './types';
import { getErrorMessage } from '@shared/utils/error';
import { useProjectTree } from './hooks/useProjectTree';
import { useSidebarReveal } from './hooks/useSidebarReveal';
import { useShallow } from 'zustand/react/shallow';
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
  ITreeViewRef,
} from '@renderer/components/TreeView';
import type { IScriptMetadata as IScript } from '@shared/types/workspace';
import { generateHash } from '@shared/utils/string';
import type { Dialect } from '@shared/types/connections';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { useI18nStore } from '@renderer/stores/I18n';
import { useToastStore } from '@renderer/stores/Toast';
import { useAppTabStore } from '@renderer/stores/AppTab';
import TableInfo from '@renderer/views/TableInfo';
import FunctionInfo from '@renderer/views/FunctionInfo';
import ProcessList from '@renderer/views/ProcessList';
import { ModalDatabaseCompare } from '@renderer/components/ModalDatabaseCompare';
import { ModalExportData } from '@renderer/components/ModalExportData';
import WholeWordIcon from '@renderer/assets/icons/whole-word.svg?react';
import { useThemeStore } from '@renderer/stores/Theme';
import { QueryEditor } from '@renderer/views/QueryEditor';
import { copyToClipboard, } from '@renderer/utils/methods';
import { ModalNewProject } from './components/ModalNewProject';
import { ModalNewConnection } from './components/ModalNewConnection';
import { ModalNewScript } from './components/ModalNewScript';
import { ModalDeleteTable } from './components/ModalDeleteTable';
import { ModalRenameTable } from './components/ModalRenameTable';
import { ModalImportTableData } from './components/ModalImportTableData';
import { ModalNewSchema } from './components/ModalNewSchema';
import { ModalDeleteSchema } from './components/ModalDeleteSchema';
import { ModalDeleteProject } from './components/ModalDeleteProject';
import { ModalRenameSchema } from './components/ModalRenameSchema';
import { ModalImportProjects } from './components/ModalImportProjects';
import styles from './styles.module.css';

const PROCESS_LIST_DIALECTS = new Set<Dialect>(['postgres', 'mysql']);

const ProjectsMenu = () => {
  const { sideBar: colors } = useThemeStore((state) => state.activeTheme);

  const { removeScript, removeConnection, loadConnectionInfo, closeConnection } = useWorkspaceStore(
    useShallow((state) => ({
      removeScript: state.removeScript,
      removeConnection: state.removeConnection,
      loadConnectionInfo: state.loadConnectionInfo,
      closeConnection: state.closeConnection,
    })),
  );

  const showToast = useToastStore((state) => state.showToast);
  const t = useI18nStore((state) => state.t);
  const { tabs, addTab, removeTab, getTab, setActiveTabId } = useAppTabStore(
    useShallow((state) => ({
      tabs: state.tabs,
      addTab: state.addTab,
      removeTab: state.removeTab,
      getTab: state.getTab,
      setActiveTabId: state.setActiveTabId,
    })),
  );
  const treeViewRef = React.useRef<ITreeViewRef>(null);
  const [loadingConnectionsId, setLoadingConnectionsId] = React.useState<string[]>([]);

  const [filterText, setFilterText] = React.useState('');
  const [isWholeWordFilter, setIsWholeWordFilter] = React.useState(false);

  const [contextMenuPosition, setContextMenuPosition] = React.useState<IContextMenuPosition>();
  const [contextMenuItemSelected, setContextMenuItemSelected] = React.useState<ProjectTreeItemData>();

  const [idProjectSelected, setIdProjectSelected] = React.useState<string>();
  const [idConnectionSelected, setIdConnectionSelected] = React.useState<string>();

  const [isNewProject, setIsNewProject] = React.useState(false);
  const [projectEditing, setProjectEditing] = React.useState<ProjectTreeItemData>();
  const [projectToDelete, setProjectToDelete] = React.useState<ProjectTreeItemData>();
  const [showImportProjects, setShowImportProjects] = React.useState(false);

  const [isNewConnection, setIsNewConnection] = React.useState(false);
  const [connectionEditing, setConnectionEditing] = React.useState<ProjectTreeItemData>();

  const [isNewScript, setIsNewScript] = React.useState(false);
  const [scriptEditing, setScriptEditing] = React.useState<IScript>();

  const [schemaToCreate, setSchemaToCreate] = React.useState<ProjectTreeItemData>();
  const [schemaToDelete, setSchemaToDelete] = React.useState<ProjectTreeItemData>();
  const [schemaToRename, setSchemaToRename] = React.useState<ProjectTreeItemData>();
  const [tableToDelete, setTableToDelete] = React.useState<ProjectTreeItemData>();
  const [tableToRename, setTableToRename] = React.useState<ProjectTreeItemData>();
  const [tableToImport, setTableToImport] = React.useState<ProjectTreeItemData>();
  const [tableToExport, setTableToExport] = React.useState<ProjectTreeItemData>();
  const [showDatabaseCompare, setShowDatabaseCompare] = React.useState(false);

  const showModalNewProject = !!(isNewProject || projectEditing);
  const showModalNewConnection = !!(isNewConnection || connectionEditing);
  const showModalNewScript = !!(isNewScript || scriptEditing);

  const {
    connectionsGroupPerProject,
    connectionsInfo,
    scriptsByConnectionId,
    projectsSerialized,
    treeViewItems,
  } = useProjectTree(
    filterText, isWholeWordFilter, loadingConnectionsId,
  );
  useSidebarReveal(treeViewRef, projectsSerialized);

  const checkHasConnection = React.useCallback(
    (id?: string) => {
      return !!id && connectionsInfo.has(id);
    },
    [connectionsInfo],
  );

  const checkSupportsProcessList = React.useCallback(
    (id?: string) => {
      if (!id) return false;

      return connectionsGroupPerProject.some((project) =>
        project.connections.some(
          (connection) => connection.id === id && PROCESS_LIST_DIALECTS.has(connection.dialect),
        ),
      );
    },
    [connectionsGroupPerProject],
  );

  const refreshConnectionInfo = React.useCallback(async (id?: string, force?: boolean) => {
    if (!id) return false;

    const hasInfo = connectionsInfo.get(id);

    if (hasInfo && !force) return;

    setLoadingConnectionsId((prevState) => [...prevState, id]);

    try {
      await loadConnectionInfo(id);
    } catch (error: unknown) {
      showToast({
        type: 'error',
        title: t('toast.connectionError'),
        description: getErrorMessage(error, t('common.unknownError')),
      });

      return false;
    } finally {
      setLoadingConnectionsId((prevState) =>
        prevState.filter((idConnection) => idConnection !== id),
      );
    }
  }, [connectionsInfo, loadConnectionInfo, showToast, t]);

  const onContextMenuTreeView = React.useCallback(
    (item: ProjectTreeItemData, event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const position = { x: event.clientX, y: event.clientY };

      setContextMenuPosition(position);
      setContextMenuItemSelected((prevState) => (item?.id === prevState?.id ? prevState : item));
    },
    [],
  );

  const onContextMenuProjectsContainer = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      const target = event.target as HTMLElement;

      if (target.closest('[id^="item_treeview_id_"]')) return;

      event.preventDefault();

      setContextMenuPosition({ x: event.clientX, y: event.clientY });
      setContextMenuItemSelected(undefined);
    },
    [],
  );

  const onCloseModalProject = React.useCallback(() => {
    setIsNewProject(false);
    setProjectEditing(null);
  }, []);

  const closeDeleteProjectModal = React.useCallback(() => {
    setProjectToDelete(null);
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

  const closeExportTableModal = React.useCallback(() => {
    setTableToExport(null);
  }, []);

  const tableExportSource = React.useMemo(() => {
    const data = tableToExport?.data;

    if (!data?.id_connection || !data?.table_name) return;

    return {
      type: 'table' as const,
      schema: data.table_schema,
      table: data.table_name,
    };
  }, [tableToExport]);

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

  const handleRemoveConnection = React.useCallback(
    async (id?: string) => {
      if (!id) return;

      await removeConnection(id);
      removeTabsFromConnections([id]);
    },
    [removeConnection, removeTabsFromConnections],
  );

  const handleOpemItemTreeView = React.useCallback(
    async (item: ProjectTreeItemData, itemIsOpen: boolean) => {
      if (itemIsOpen) return;

      if (item.type === 'connection') {
        const success = await refreshConnectionInfo(item.id);
        return success;
      }
    },
    [refreshConnectionInfo],
  );

  const handleClickItemThreeView = React.useCallback((item: ProjectTreeItemData) => {
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
      component: ({ isActiveTab }) => <QueryEditor isActiveTab={isActiveTab} id_connection={script.id_connection} id_script={script.id} />,
    });
  }, [addTab, getTab, refreshConnectionInfo, setActiveTabId]);

  const openSelectedConnectionScript = React.useCallback(() => {
    if (!idConnectionSelected) return;

    const connectionScripts = scriptsByConnectionId.get(idConnectionSelected) || [];
    const script = connectionScripts[connectionScripts.length - 1];

    script ? openTabScriptSql(script) : setIsNewScript(true);
  }, [idConnectionSelected, openTabScriptSql, scriptsByConnectionId]);

  const openDatabaseCompare = React.useCallback(() => {
    setShowDatabaseCompare(true);
  }, []);

  const openProcessList = React.useCallback(
    async (idConnection?: string) => {
      if (!idConnection) return;

      const connected = await refreshConnectionInfo(idConnection);

      if (connected === false) return;

      const tabId = `process_list_${idConnection}`;
      const tab = getTab(tabId);

      if (tab) {
        setActiveTabId(tabId);
        return;
      }

      addTab({
        id: tabId,
        title: t('processList.title'),
        data: {
          type: 'process-list',
          id_connection: idConnection,
        },
        component: () => <ProcessList id_connection={idConnection} />,
      });
    },
    [addTab, getTab, refreshConnectionInfo, setActiveTabId, t],
  );

  const handleDoubleClickItemThreeView = React.useCallback((item: ProjectTreeItemData) => {
    if (item.type === 'table') {
      const { id_connection, table_schema: schema, table_name: table } = item.data;
      const tabId = `${id_connection}_${schema}_${table}`;
      const title = `${schema ? `${schema}.` : ''}${table}`;
      const objectType = item.data.object_type || 'table';
      const supportsIndexes = item.data.supports_indexes;
      const supportsTriggers = item.data.supports_triggers;

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
            objectType,
            supportsIndexes,
            supportsTriggers,
          },
          component: () => (
            <TableInfo
              id_connection={id_connection}
              schema={schema}
              table={table}
              appTabId={tabId}
              objectType={objectType}
              supportsIndexes={supportsIndexes}
              supportsTriggers={supportsTriggers}
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
    const rootOptions: IContextMenuOption[] = [
      {
        text: t('project.add'),
        onClick: () => setIsNewProject(true),
      },
      {
        text: t('project.import'),
        onClick: () => setShowImportProjects(true),
      },
      {
        text: t('databaseCompare.title'),
        onClick: () => openDatabaseCompare(),
      },
    ];

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
          onClick: () => setProjectToDelete(contextMenuItemSelected),
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
        checkSupportsProcessList(contextMenuItemSelected?.id) && {
          text: t('context.openProcessList'),
          onClick: () => openProcessList(contextMenuItemSelected?.id),
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
          text: t('modal.exportData'),
          onClick: () => setTableToExport(contextMenuItemSelected),
        },
        contextMenuItemSelected?.data?.object_type !== 'view' &&
          contextMenuItemSelected?.data?.object_type !== 'materialized_view' && {
            text: t('modal.importData'),
            onClick: () => setTableToImport(contextMenuItemSelected),
          },
        contextMenuItemSelected?.data?.object_type !== 'view' &&
          contextMenuItemSelected?.data?.object_type !== 'materialized_view' && {
            text: t('modal.renameTable'),
            onClick: () => setTableToRename(contextMenuItemSelected),
          },
        contextMenuItemSelected?.data?.object_type !== 'view' &&
          contextMenuItemSelected?.data?.object_type !== 'materialized_view' && {
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

    return contextMenuItemSelected
      ? optionsAvailable[contextMenuItemSelected.type] || []
      : rootOptions;
  }, [
    addTab,
    checkHasConnection,
    checkSupportsProcessList,
    closeConnection,
    contextMenuItemSelected,
    handleRemoveConnection,
    openDatabaseCompare,
    openProcessList,
    refreshConnectionInfo,
    removeScript,
    removeTab,
    t,
  ]);

  const closeContextMenu = React.useCallback(() => {
    setContextMenuPosition(undefined);
    setContextMenuItemSelected(undefined);
  }, []);

  const openNewProject = React.useCallback(() => {
    setIsNewProject(true);
  }, []);

  const closeImportProjectsModal = React.useCallback(() => {
    setShowImportProjects(false);
  }, []);

  const closeDatabaseCompareModal = React.useCallback(() => {
    setShowDatabaseCompare(false);
  }, []);

  const projectOptions = React.useMemo(
    () => [
      { id: 'add', label: t('project.add') },
      { id: 'import-projects', label: t('project.import') },
      { id: 'database-compare', label: t('databaseCompare.title') },
    ],
    [t],
  );

  const handleSelectProjectOption = React.useCallback(
    (option: IButtonDropdownOption) => {
      if (option.id === 'add') openNewProject();
      if (option.id === 'import-projects') setShowImportProjects(true);
      if (option.id === 'database-compare') openDatabaseCompare();
    },
    [openDatabaseCompare, openNewProject],
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

      <ModalDeleteProject
        show={!!projectToDelete}
        idProject={projectToDelete?.id}
        project={projectToDelete?.label}
        onClose={closeDeleteProjectModal}
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

      <ModalExportData
        show={!!tableToExport}
        idConnection={tableToExport?.data?.id_connection}
        source={tableExportSource}
        fileName={[tableToExport?.data?.table_schema, tableToExport?.data?.table_name]
          .filter(Boolean)
          .join('.')}
        onClose={closeExportTableModal}
      />

      <ModalImportProjects show={showImportProjects} onClose={closeImportProjectsModal} />

      <ModalDatabaseCompare
        show={showDatabaseCompare}
        onClose={closeDatabaseCompareModal}
      />

      <Row>
        <Text bold color={colors.color} userSelect={false}>
          {t('sidebar.projects')}
        </Text>

        <Spacer />

        {!!idConnectionSelected && (
          <Button
            smallIcon
            text
            title={t('tooltip.openSqlEditor')}
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
            title={t('common.exactWord')}
            icon={() => <WholeWordIcon />}
            color={isWholeWordFilter ? 'white' : 'gray'}
            onClick={toggleWholeWordFilter}
          />
        )}
      />

      <Divider />

      <div
        className={styles.containerTreeViewProjects}
        onContextMenu={onContextMenuProjectsContainer}
      >
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
