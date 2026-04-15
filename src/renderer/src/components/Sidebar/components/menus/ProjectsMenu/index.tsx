import React from 'react';
import { Divider } from '@renderer/components/Divider';
import { Input } from '@renderer/components/Input';
import { Text } from '@renderer/components/Text';
import { Button } from '@renderer/components/Button';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { ModalNewProject } from '@renderer/components/ModalNewProject';
import { ModalNewConnection } from '@renderer/components/ModalNewConnection';
import { AddIcon, AddSqlIcon } from '@renderer/styles/icons';
import {
  ContextMenu,
  IContextMenuOption,
  IContextMenuPosition,
} from '@renderer/components/ContextMenu';
import TreeView, { IItemTreeView, IItemTreeViewData } from '@renderer/components/TreeView';
import { useStoreContext } from '@renderer/contexts/Store';
import { useToast } from '@renderer/contexts/Toast';
import styles from './styles.module.css';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import TableInfo from '@renderer/views/TableInfo';
import FunctionInfo from '@renderer/views/FunctionInfo';
import WholeWordIcon from '@renderer/assets/icons/whole-word.svg?react';
import { useThemeContext } from '@renderer/contexts/Theme';
import { generateHash } from '@renderer/utils/string';
import { QueryEditor } from '@renderer/views/QueryEditor';
import { copyToClipboard, formatSizeFromBytes } from '@renderer/utils/methods';

const ProjectsMenu = () => {
  const {
    connectionsGroupPerProject,
    removeConnection,
    removeProject,
    loadConnectionInfo,
    closeConnection,
    connectionsInfo,
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
  const [selectedConnection, setSelectedConnection] = React.useState(null);
  const [connectionEditing, setConnectionEditing] = React.useState<IItemTreeViewData>();

  const [contextMenuPosition, setContextMenuPosition] = React.useState<IContextMenuPosition>();
  const [contextMenuItemSelected, setContextMenuItemSelected] = React.useState<IItemTreeViewData>();

  const showModalNewProject = !!(isNewProject || projectEditing);
  const showModalNewConnection = !!(projectNewConnection || connectionEditing);
  const filterTextSerialized = filterText?.trim?.();

  const checkFilterText = (text: string) => {
    if (isWholeWordFilter) {
      return text?.toLowerCase?.() === filterTextSerialized;
    }
    return text?.toLowerCase?.()?.includes?.(filterTextSerialized);
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

  const handleDoubleClickItemThreeView = (item: IItemTreeViewData) => {
    if (item.type === 'table') {
      const { id_connection, table_schema: schema, table_name: table } = item.data;
      const tabId = `${id_connection}_${schema}_${table}`;

      const tab = getTab(tabId);

      if (tab) {
        setActiveTabId(tabId);
      } else {
        addTab({
          id: tabId,
          title: table,
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
    }
  };

  const handleOpenNewSqlFile = () => {
    const { id_connection, description_connection } = selectedConnection;

    refreshConnectionInfo(id_connection);

    addTab({
      id: generateHash(),
      title: `Sem título [${description_connection}]`,
      component: () => <QueryEditor id_connection={id_connection} />,
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
    };

    return optionsAvailable[contextMenuItemSelected?.type] || [];
  }, [contextMenuItemSelected]);

  const projectsSerialized = connectionsGroupPerProject.map((project) => {
    let hasContentWithFilterText = false;

    const projects: IItemTreeView = {
      id: project.id,
      label: project.description,
      type: 'project' as const,
      childs: project.connections.map((connection) => {
        const connectionInfo = connectionsInfo.get(connection.id);

        let tablesThreeView: IItemTreeView[] =
          connectionInfo?.tables?.map((table) => {
            const { table_name, table_schema, total_size } = table;

            const data = {
              ...table,
              id_connection: connection.id,
              description_connection: connection.description,
            };

            return {
              id: table_schema
                ? `${connection.id}:${table_schema}_${table_name}`
                : `${connection.id}:${table_name}`,
              label: table_name,
              labelInfo: formatSizeFromBytes(total_size),
              icon: 'table' as const,
              type: 'table' as const,
              data: data,
            };
          }) || [];

        let functionsThreeView: IItemTreeView[] =
          connectionInfo?.functions?.map((fn, index) => {
            const { function_name, function_schema } = fn;

            const data = {
              ...fn,
              id_connection: connection.id,
              description_connection: connection.description,
            };

            return {
              id: function_schema
                ? `${connection.id}:${function_schema}_${function_name}:${index}`
                : `${connection.id}:${function_name}:${index}`,
              label: function_name,
              icon: 'table' as const,
              type: 'function' as const,
              data,
            };
          }) || [];

        if (filterTextSerialized) {
          tablesThreeView = tablesThreeView.filter((table) => checkFilterText(table?.label));
          functionsThreeView = functionsThreeView.filter((fn) => checkFilterText(fn?.label));
        }

        let schemasThreeView: IItemTreeView[] =
          connectionInfo?.schemas?.map?.((schema) => {
            const tablesSchema = tablesThreeView.filter(({ data }) => data.table_schema === schema);
            const functionsSchema = functionsThreeView.filter(
              ({ data }) => data.function_schema === schema,
            );

            const dataSchema = {
              id_connection: connection.id,
              description_connection: connection.description,
              schema_name: schema,
            };

            return {
              id: `${connection.id}:${schema}`,
              label: schema,
              data: dataSchema,
              icon: 'folder' as const,
              type: 'schema' as const,
              childs: [
                tablesSchema?.length && {
                  id: `tables_${connection.id}:${schema}`,
                  label: 'Tabelas',
                  childs: tablesSchema,
                },
                functionsSchema?.length && {
                  id: `fns_${connection.id}:${schema}`,
                  label: 'Funções',
                  childs: functionsSchema,
                },
              ],
            };
          }) || [];

        if (filterTextSerialized) {
          schemasThreeView = schemasThreeView.filter((schema) =>
            schema.childs.some((group) => group.childs?.length),
          );
        }

        const schemasOrTables = schemasThreeView || tablesThreeView || [];

        hasContentWithFilterText =
          hasContentWithFilterText || !!tablesThreeView.length || !!functionsThreeView.length;

        return {
          id: connection.id,
          label: connection.description,
          loading: loadingConnectionsId.includes(connection.id),
          icon: 'database' as const,
          type: 'connection' as const,
          data: { id_connection: connection.id, description_connection: connection.description },
          childs: schemasOrTables,
        };
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

      <Row>
        <Text bold color={colors.color} userSelect={false}>
          Projetos
        </Text>

        <Spacer />

        {!!selectedConnection && (
          <Button
            smallIcon
            text
            title="Novo SQL"
            color={colors.color}
            icon={() => <AddSqlIcon size={14} />}
            onClick={handleOpenNewSqlFile}
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
