import React from 'react';
import { Divider } from '@renderer/components/Divider';
import { Input } from '@renderer/components/Input';
import { Text } from '@renderer/components/Text';
import { Button } from '@renderer/components/Button';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { AddIcon, FileSqlIcon } from '@renderer/styles/icons';
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
import { ModalNewSchema } from './components/ModalNewSchema';
import { ModalDeleteSchema } from './components/ModalDeleteSchema';
import { ModalRenameSchema } from './components/ModalRenameSchema';
import styles from './styles.module.css';

const ProjectsMenu = () => {
  const {
    activeTheme: { __colors, sideBar: colors },
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
  const { addTab, removeTab, getTab, setActiveTabId } = useAppTabContext();
  const treeViewRef = React.useRef<ITreeViewRef>(null);
  const [loadingConnectionsId, setLoadingConnectionsId] = React.useState<string[]>([]);

  const [filterText, setFilterText] = React.useState('');
  const [isWholeWordFilter, setIsWholeWordFilter] = React.useState(false);

  const [contextMenuPosition, setContextMenuPosition] = React.useState<IContextMenuPosition>();
  const [contextMenuItemSelected, setContextMenuItemSelected] = React.useState<IItemTreeViewData>();

  const [idProjectSelected, setIdProjectSelected] = React.useState<string>();
  const [idConnectionSelected, setIdConnectionSelected] = React.useState<string>();

  const [isNewProject, setIsNewProject] = React.useState(false);
  const [projectEditing, setProjectEditing] = React.useState<IItemTreeViewData>();

  const [isNewConnection, setIsNewConnection] = React.useState(false);
  const [connectionEditing, setConnectionEditing] = React.useState<IItemTreeViewData>();

  const [isNewScript, setIsNewScript] = React.useState(false);
  const [scriptEditing, setScriptEditing] = React.useState<IScript>();

  const [schemaToCreate, setSchemaToCreate] = React.useState<IItemTreeViewData>();
  const [schemaToDelete, setSchemaToDelete] = React.useState<IItemTreeViewData>();
  const [schemaToRename, setSchemaToRename] = React.useState<IItemTreeViewData>();
  const [tableToDelete, setTableToDelete] = React.useState<IItemTreeViewData>();
  const [tableToRename, setTableToRename] = React.useState<IItemTreeViewData>();

  const showModalNewProject = !!(isNewProject || projectEditing);
  const showModalNewConnection = !!(isNewConnection || connectionEditing);
  const showModalNewScript = !!(isNewScript || scriptEditing);

  const filterTextSerialized = filterText?.trim?.() ?? '';

  const checkFilterText = (text: string, text2?: string) => {
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
  };

  const checkHasConnection = (id: string) => {
    return connectionsInfo.has(id);
  };

  const refreshConnectionInfo = async (id: string, force?: boolean) => {
    const hasInfo = connectionsInfo.get(id);

    if (hasInfo && !force) return;

    setLoadingConnectionsId((prevState) => [...prevState, id]);

    try {
      await loadConnectionInfo(id);
    } catch (error) {
      showToast({
        type: 'error',
        title: 'Erro ao realizar a conexão',
        description: error.message,
      });

      return false;
    } finally {
      setLoadingConnectionsId((prevState) =>
        prevState.filter((idConnection) => idConnection !== id),
      );
    }
  };

  const onContextMenuTreeView = (
    item: IItemTreeViewData,
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
  ) => {
    const position = { x: event.clientX, y: event.clientY };

    setContextMenuPosition(position);

    if (item?.id !== contextMenuItemSelected?.id) {
      setContextMenuItemSelected(item);
    }
  };

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

  const handleOpemItemTreeView = async (item: IItemTreeViewData, itemIsOpen: boolean) => {
    if (itemIsOpen) return;

    if (item.type === 'connection') {
      const success = await refreshConnectionInfo(item.id);
      return success;
    }
  };

  const handleClickItemThreeView = (item: IItemTreeViewData) => {
    setIdConnectionSelected(item?.data?.id_connection);
    setIdProjectSelected(item?.data?.id_project);
  };

  const openTabScriptSql = (script: IScript) => {
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
      },
      component: () => <QueryEditor id_connection={script.id_connection} id_script={script.id} />,
    });
  };

  const handleDoubleClickItemThreeView = (item: IItemTreeViewData) => {
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
            <TableInfo id_connection={id_connection} schema={schema} table={table} />
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
  };

  const contextOptions = React.useMemo(() => {
    const optionsAvailable: Record<string, IContextMenuOption[]> = {
      project: [
        {
          text: 'Nova Conexão',
          onClick: () => setIsNewConnection(true),
        },
        {
          text: 'Editar Projeto',
          onClick: () => setProjectEditing(contextMenuItemSelected),
        },
        {
          text: 'Excluir Projeto',
          onClick: () => removeProject(contextMenuItemSelected?.id),
        },
      ],

      connection: [
        !checkHasConnection(contextMenuItemSelected?.id) && {
          text: 'Conectar',
          onClick: () => refreshConnectionInfo(contextMenuItemSelected?.id),
        },
        checkHasConnection(contextMenuItemSelected?.id) && {
          text: 'Desconectar',
          onClick: async () => {
            await closeConnection(contextMenuItemSelected?.id);
            await treeViewRef.current?.switch(contextMenuItemSelected?.id, false);
          },
        },
        {
          text: 'Recarregar',
          onClick: () => refreshConnectionInfo(contextMenuItemSelected?.id, true),
        },
        {
          text: 'Editar Conexão',
          onClick: () => setConnectionEditing(contextMenuItemSelected),
        },
        {
          text: 'Excluir Conexão',
          onClick: () => removeConnection(contextMenuItemSelected?.id),
        },
      ],

      schemas: [
        {
          text: 'Criar novo schema',
          onClick: () => setSchemaToCreate(contextMenuItemSelected),
        },
      ],

      schema: [
        {
          text: 'Copiar',
          onClick: () => copyToClipboard(contextMenuItemSelected.data.schema_name),
        },
        {
          text: 'Renomear Esquema',
          onClick: () => setSchemaToRename(contextMenuItemSelected),
        },
        {
          text: 'Excluir Esquema',
          onClick: () => setSchemaToDelete(contextMenuItemSelected),
        },
      ],

      table: [
        {
          text: 'Copiar',
          onClick: () => {
            const data = contextMenuItemSelected?.data;
            copyToClipboard([data.table_schema, data.table_name].filter(Boolean).join('.'));
          },
        },
        {
          text: 'Renomear Tabela',
          onClick: () => setTableToRename(contextMenuItemSelected),
        },
        {
          text: 'Excluir Tabela',
          onClick: () => setTableToDelete(contextMenuItemSelected),
        },
      ],

      tables: [
        {
          text: 'Criar nova tabela',
          onClick: () => {
            const { id_connection, schema_name } = contextMenuItemSelected?.data || {};
            if (!id_connection) return;

            const tabId = `new_table_${id_connection}_${schema_name || 'public'}_${generateHash()}`;

            addTab({
              id: tabId,
              title: 'Nova tabela',
              unsaved: true,
              component: () => (
                <TableInfo
                  id_connection={id_connection}
                  schema={schema_name}
                  table=""
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
          text: 'Novo script SQL',
          onClick: () => setIsNewScript(true),
        },
      ],

      script: [
        {
          text: 'Renomear Script',
          onClick: () => setScriptEditing(contextMenuItemSelected?.data?.script),
        },
        {
          text: 'Excluir Script',
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
  }, [contextMenuItemSelected]);

  const projectsSerialized = connectionsGroupPerProject.map((project) => {
    let hasContentWithFilterText = false;

    const projects: IItemTreeView = {
      id: project.id,
      label: project.description,
      type: 'project' as const,
      icon: 'grid',
      data: { id_project: project.id },
      childs: project.connections.map((connection) => {
        const connectionInfo = connectionsInfo.get(connection.id);

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

        let functionsThreeView: IItemTreeView[] =
          connectionInfo?.functions?.map((fn, index) => {
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
          }) || [];

        const connectionScripts = scripts.filter((s) => s.id_connection === connection.id);

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

        let schemasThreeView: IItemTreeView[] =
          connectionInfo?.schemas?.map?.((schema) => {
            const tablesSchema = tablesThreeView.filter(({ data }) => data.table_schema === schema);
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
                  label: 'Tabelas',
                  icon: 'multi',
                  childs: tablesSchema,
                  type: 'tables' as const,
                  data: { schema_name: schema, ...dataConnection },
                },
                {
                  id: `fns_${connection.id}:${schema}`,
                  label: 'Funções',
                  childs: functionsSchema,
                  icon: 'functions',
                },
              ],
            };
          }) || [];

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
          labelInfo: `${connection.host}:${connection.port}`,
          loading: loadingConnectionsId.includes(connection.id),
          icon: 'database' as const,
          type: 'connection' as const,
          data: { id_connection: connection.id, description_connection: connection.description },
          childs: [
            {
              id: `schemas_${connection.id}`,
              type: 'schemas',
              label: 'Esquemas',
              childs: schemasThreeView,
              icon: 'schema',
              data: dataConnection,
            },
            !schemasThreeView && {
              id: `tables_${connection.id}`,
              type: 'tables',
              label: 'Tabelas',
              childs: tablesThreeView,
              data: dataConnection,
            },
            {
              id: `scripts_${connection.id}`,
              type: 'scripts',
              label: 'Scripts',
              childs: scriptsThreeView,
              icon: 'fileSql',
              data: dataConnection,
            },
          ],
        } as IItemTreeView;
      }),
    };

    return { ...projects, hasContentWithFilterText };
  });

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

      <Row>
        <Text bold color={colors.color} userSelect={false}>
          Projetos
        </Text>

        <Spacer />

        {!!idConnectionSelected && (
          <Button
            smallIcon
            text
            title="Abrir editor SQL"
            color={colors.color}
            icon={() => <FileSqlIcon size={14} />}
            onClick={() => {
              const connectionScripts = scripts.filter(
                (s) => s.id_connection === idConnectionSelected,
              );

              const script = connectionScripts[connectionScripts.length - 1];

              script ? openTabScriptSql(script) : setIsNewScript(true);
            }}
          />
        )}

        <Button
          smallIcon
          text
          title="Adicionar Novo Projeto"
          color={colors.color}
          icon={() => <AddIcon size={12} />}
          onClick={() => setIsNewProject(true)}
        />
      </Row>

      <Divider />

      <Input
        id="input_filter_projects"
        placeholder="Filtrar"
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
            onClick={() => setIsWholeWordFilter((prevState) => !prevState)}
          />
        )}
      />

      <Divider />

      <div className={styles.containerTreeViewProjects}>
        <TreeView
          ref={treeViewRef}
          onContextMenu={onContextMenuTreeView}
          onSwitchItem={handleOpemItemTreeView}
          onDoubleClick={handleDoubleClickItemThreeView}
          onClick={handleClickItemThreeView}
          items={
            filterTextSerialized
              ? projectsSerialized.filter((project) => project.hasContentWithFilterText)
              : projectsSerialized
          }
        />

        <ContextMenu
          position={contextMenuPosition}
          options={contextOptions}
          onClose={() => setContextMenuItemSelected(null)}
        />
      </div>
    </>
  );
};

export default React.memo(ProjectsMenu);
