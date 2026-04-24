import React from 'react';
import { Divider } from '@renderer/components/Divider';
import { Input } from '@renderer/components/Input';
import { Text } from '@renderer/components/Text';
import { Button } from '@renderer/components/Button';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { ModalNewProject } from '@renderer/components/ModalNewProject';
import { ModalNewConnection } from '@renderer/components/ModalNewConnection';
import { ModalNewScript } from '@renderer/components/ModalNewScript';
import { AddIcon, FileSqlIcon } from '@renderer/styles/icons';
import {
  ContextMenu,
  IContextMenuOption,
  IContextMenuPosition,
} from '@renderer/components/ContextMenu';
import TreeView, { IItemTreeView, IItemTreeViewData } from '@renderer/components/TreeView';
import { IScript, useStoreContext } from '@renderer/contexts/Store';
import { useToast } from '@renderer/contexts/Toast';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import TableInfo from '@renderer/views/TableInfo';
import FunctionInfo from '@renderer/views/FunctionInfo';
import WholeWordIcon from '@renderer/assets/icons/whole-word.svg?react';
import { useThemeContext } from '@renderer/contexts/Theme';
import { QueryEditor } from '@renderer/views/QueryEditor';
import { copyToClipboard, formatSizeFromBytes } from '@renderer/utils/methods';
import styles from './styles.module.css';

const ProjectsMenu = () => {
  const {
    connectionsGroupPerProject,
    removeConnection,
    removeProject,
    loadConnectionInfo,
    closeConnection,
    connectionsInfo,
    scripts,
    addScript,
    removeScript,
  } = useStoreContext();

  const {
    activeTheme: { sideBar: colors },
  } = useThemeContext();

  const { showToast } = useToast();
  const { addTab, getTab, setActiveTabId } = useAppTabContext();
  const [loadingConnectionsId, setLoadingConnectionsId] = React.useState<string[]>([]);

  const [filterText, setFilterText] = React.useState('');
  const [isWholeWordFilter, setIsWholeWordFilter] = React.useState(false);

  const [isNewProject, setIsNewProject] = React.useState(false);
  const [projectEditing, setProjectEditing] = React.useState<IItemTreeViewData>();
  const [projectNewConnection, setProjectNewConnection] = React.useState<IItemTreeViewData>();
  const [selectedConnection, setSelectedConnection] = React.useState<ISelectedConnection | null>(
    null,
  );
  const [connectionEditing, setConnectionEditing] = React.useState<IItemTreeViewData>();

  const [showMoodalNewScript, setShowModalNewScript] = React.useState(false);

  const [contextMenuPosition, setContextMenuPosition] = React.useState<IContextMenuPosition>();
  const [contextMenuItemSelected, setContextMenuItemSelected] = React.useState<IItemTreeViewData>();

  const showModalNewProject = !!(isNewProject || projectEditing);
  const showModalNewConnection = !!(projectNewConnection || connectionEditing);
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

  const onCloseModalProject = () => {
    setIsNewProject(false);
    setProjectEditing(null);
  };

  const onCloseModalConnection = () => {
    setProjectNewConnection(null);
    setConnectionEditing(null);
  };

  const handleOpemItemTreeView = async (item: IItemTreeViewData, itemIsOpen: boolean) => {
    if (itemIsOpen) return;

    if (item.type === 'connection') {
      const success = await refreshConnectionInfo(item.id);
      return success;
    }
  };

  const handleClickItemThreeView = (item: IItemTreeViewData) => {
    setSelectedConnection(item?.data?.id_connection && item?.data);
  };

  const openTabScriptSql = (script: IScript) => {
    const tabId = `script_${script.id}`;

    const tab = getTab(tabId);

    if (tab) return setActiveTabId(tabId);

    refreshConnectionInfo(script.id_connection);

    addTab({
      id: tabId,
      title: script.name,
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
          title: function_name,
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

  const handleCreateNewScript = async (name: string) => {
    const { id_connection } = selectedConnection;

    refreshConnectionInfo(id_connection);

    const script = await addScript({
      name,
      id_connection,
      content: '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setShowModalNewScript(false);

    addTab({
      id: `script_${script.id}`,
      title: script.name,
      component: () => <QueryEditor id_connection={script.id_connection} id_script={script.id} />,
    });
  };

  const contextOptions = React.useMemo(() => {
    const optionsAvailable: Record<string, IContextMenuOption[]> = {
      project: [
        {
          text: 'Nova Conexão',
          onClick: () => setProjectNewConnection(contextMenuItemSelected),
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
          onClick: () => closeConnection(contextMenuItemSelected?.id),
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

      schema: [
        {
          text: 'Copiar',
          onClick: () => copyToClipboard(contextMenuItemSelected.data.schema_name),
        },
        {
          text: 'Renomear Esquema',
          onClick: () => {},
        },
        {
          text: 'Excluir Esquema',
          onClick: () => {},
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
          onClick: () => {},
        },
        {
          text: 'Excluir Tabela',
          onClick: () => {},
        },
      ],

      scripts: [
        {
          text: 'Novo script SQL',
          onClick: () => setShowModalNewScript(true),
        },
      ],

      script: [
        {
          text: 'Excluir Script',
          onClick: () => removeScript(contextMenuItemSelected?.data?.script?.id),
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
      childs: project.connections.map((connection) => {
        const connectionInfo = connectionsInfo.get(connection.id);

        const dataConnection = {
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
                tablesSchema?.length && {
                  id: `tables_${connection.id}:${schema}`,
                  label: 'Tabelas',
                  icon: 'multi',
                  childs: tablesSchema,
                },
                functionsSchema?.length && {
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
      <ModalNewConnection
        show={showModalNewConnection}
        idConnection={connectionEditing?.id}
        idProject={projectNewConnection?.id}
        onClose={onCloseModalConnection}
      />

      <ModalNewProject
        show={showModalNewProject}
        onClose={onCloseModalProject}
        idProject={projectEditing?.id}
      />

      <ModalNewScript
        show={showMoodalNewScript}
        onConfirm={handleCreateNewScript}
        onClose={() => setShowModalNewScript(false)}
      />

      <Row>
        <Text bold color={colors.color} userSelect={false}>
          Projetos
        </Text>

        <Spacer />

        {!!selectedConnection && (
          <Button
            smallIcon
            text
            title="Abrir editor SQL"
            color={colors.color}
            icon={() => <FileSqlIcon size={14} />}
            onClick={() => {
              const connectionScripts = scripts.filter(
                (s) => s.id_connection === selectedConnection.id_connection,
              );

              const script = connectionScripts[connectionScripts.length - 1];

              script ? openTabScriptSql(script) : setShowModalNewScript(true);
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

interface ISelectedConnection {
  id_connection: string;
}
