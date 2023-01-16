import React from 'react';
import { Divider } from '@renderer/components/Divider';
import { Input } from '@renderer/components/Input';
import { Text } from '@renderer/components/Text';
import { Button } from '@renderer/components/Button';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { ModalNewProject } from '@renderer/components/ModalNewProject';
import { ModalNewConnection } from '@renderer/components/ModalNewConnection';
import { AddIcon } from '@renderer/styles/icons';
import { ContextMenu, IContextMenuPosition } from '@renderer/components/ContextMenu';
import TreeView, { IItemTreeViewData } from '@renderer/components/TreeView';
import { useStoreContext } from '@renderer/contexts/Store';
import { useToast } from '@renderer/contexts/Toast';
import styles from './styles.module.css';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import TableInfo from '@renderer/views/TableInfo';
import { ReactComponent as WholeWordIcon } from '@renderer/assets/icons/whole-word.svg';

const ProjectsMenu = () => {
  const {
    connectionsGroupPerProject,
    removeConnection,
    removeProject,
    loadConnectionInfo,
    connectionsInfo,
  } = useStoreContext();

  const { showToast } = useToast();
  const { addTab, getTab, setActiveTabId } = useAppTabContext();
  const [loadingConnectionsId, setLoadingConnectionsId] = React.useState<string[]>([]);

  const [filterText, setFilterText] = React.useState('');
  const [isWholeWordFilter, setIsWholeWordFilter] = React.useState(false);

  const [isNewProject, setIsNewProject] = React.useState(false);
  const [projectEditing, setProjectEditing] = React.useState<IItemTreeViewData>();
  const [projectNewConnection, setProjectNewConnection] = React.useState<IItemTreeViewData>();
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
    return text?.toLowerCase?.()?.includes?.(filterTextSerialized)
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

  const handleDoubleClickItemThreeView = async (item: IItemTreeViewData) => {
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
    }
  };

  const contextOptions = React.useMemo(() => {
    const optionsAvailable = {
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
    let hasTableWithFilterText = false;

    const projects = {
      id: project.id,
      label: project.description,
      type: 'project' as const,
      childs: project.connections.map((connection) => {
        const connectionInfo = connectionsInfo.get(connection.id);

        let tablesThreeView =
          connectionInfo?.tables?.map((table) => {
            const { table_name, table_schema } = table;

            const dataTable = {
              ...table,
              id_connection: connection.id,
            };

            return {
              id: table_schema ? `${table_schema}_${table_name}` : `${table_name}`,
              label: table_name,
              data: dataTable,
              icon: 'table' as const,
              type: 'table' as const,
            };
          }) || [];

        if (filterTextSerialized) {
          tablesThreeView = tablesThreeView.filter((table) => checkFilterText(table?.label));
        }

        let schemasThreeView =
          connectionInfo?.schemas?.map?.((schema) => {
            const tablesSchema = tablesThreeView.filter(({ data }) => data.table_schema === schema);

            const dataSchema = {
              id_connection: connection.id,
            };

            return {
              id: schema,
              label: schema,
              data: dataSchema,
              icon: 'file2' as const,
              type: 'schema' as const,
              childs: tablesSchema,
            };
          }) || [];

        if (filterTextSerialized) {
          schemasThreeView = schemasThreeView.filter((schema) => schema.childs.length);
        }

        const schemasOrTables = schemasThreeView || tablesThreeView || [];

        hasTableWithFilterText = hasTableWithFilterText || !!tablesThreeView.length;

        return {
          id: connection.id,
          label: connection.description,
          loading: loadingConnectionsId.includes(connection.id),
          icon: 'database' as const,
          type: 'connection' as const,
          childs: schemasOrTables,
        };
      }),
    };

    return { ...projects, hasTableWithFilterText };
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
        <Text bold userSelect={false}>Projetos</Text>

        <Spacer />

        <Button
          smallIcon
          text
          title="Adicionar Novo Projeto"
          icon={() => <AddIcon size={12} />}
          onClick={() => setIsNewProject(true)}
        />
      </Row>

      <Divider color="transparent" />

      <Input
        placeholder="Filtrar"
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
        icon={() => (
          <Button
            smallIcon
            text
            title="Adicionar Novo Projeto"
            icon={() => <WholeWordIcon />}
            color={isWholeWordFilter ? 'white' : 'gray'}
            onClick={() => setIsWholeWordFilter(prevState => !prevState)}
          />
        )}
      />

      <Divider color="transparent" />

      <div className={styles.containerTreeViewProjects}>
        <TreeView
          fixMargin
          onContextMenu={onContextMenuTreeView}
          onSwitchItem={handleOpemItemTreeView}
          onDoubleClick={handleDoubleClickItemThreeView}
          items={
            filterTextSerialized
              ? projectsSerialized.filter((project) => project.hasTableWithFilterText)
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
