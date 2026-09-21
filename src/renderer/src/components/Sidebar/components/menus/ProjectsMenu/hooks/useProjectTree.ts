import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { IItemTreeView } from '@renderer/components/TreeView';
import type { IScriptMetadata as IScript } from '@shared/types/workspace';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { selectConnectionsGroupPerProject } from '@renderer/stores/Workspace/selectors';
import { useI18nStore } from '@renderer/stores/I18n';
import { getRendererDialect } from '@renderer/database/dialects';
import { formatSizeFromBytes } from '@renderer/utils/methods';

export const useProjectTree = (
  filterText: string,
  isWholeWordFilter: boolean,
  loadingConnectionsId: string[],
) => {
  const t = useI18nStore((state) => state.t);
  const connectionsGroupPerProject = useWorkspaceStore(selectConnectionsGroupPerProject);
  const { scripts, connectionsInfo } = useWorkspaceStore(
    useShallow((state) => ({
      scripts: state.scripts,
      connectionsInfo: state.connectionsInfo,
    })),
  );
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

  const checkFilterText = React.useCallback(
    (text: string, text2?: string) => {
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
    },
    [filterTextSerialized, isWholeWordFilter],
  );

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

          let databaseObjectsThreeView: IItemTreeView[] =
            connectionInfo?.tables?.map((table) => {
              const { table_name, table_schema, total_size, object_type = 'table' } = table;

              return {
                id: table_schema
                  ? `${connection.id}:${table_schema}_${table_name}`
                  : `${connection.id}:${table_name}`,
                label: table_name,
                labelInfo: formatSizeFromBytes(total_size),
                icon: 'table' as const,
                type: 'table' as const,
                data: { ...table, object_type, ...dataConnection },
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
            databaseObjectsThreeView = databaseObjectsThreeView.filter((table) =>
              checkFilterText(table?.label, table?.data?.table_schema),
            );
            functionsThreeView = functionsThreeView.filter((fn) =>
              checkFilterText(fn?.label, fn?.data?.function_schema),
            );
          }

          const tablesThreeView = databaseObjectsThreeView.filter(
            ({ data }) => data.object_type === 'table',
          );
          const viewsThreeView = databaseObjectsThreeView.filter(
            ({ data }) => data.object_type === 'view',
          );
          const materializedViewsThreeView = databaseObjectsThreeView.filter(
            ({ data }) => data.object_type === 'materialized_view',
          );

          let schemasThreeView: IItemTreeView[] = dialect.supportsSchemas
            ? connectionInfo?.schemas?.map?.((schema) => {
                const tablesSchema = tablesThreeView.filter(
                  ({ data }) => data.table_schema === schema,
                );
                const viewsSchema = viewsThreeView.filter(
                  ({ data }) => data.table_schema === schema,
                );
                const materializedViewsSchema = materializedViewsThreeView.filter(
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
                    !!viewsSchema.length && {
                      id: `views_${connection.id}:${schema}`,
                      label: t('tabs.views'),
                      icon: 'multi',
                      childs: viewsSchema,
                      type: 'views' as const,
                      data: { schema_name: schema, ...dataConnection },
                    },
                    !!materializedViewsSchema.length && {
                      id: `mat_views_${connection.id}:${schema}`,
                      label: t('tabs.materializedViews'),
                      icon: 'multi',
                      childs: materializedViewsSchema,
                      type: 'materializedViews' as const,
                      data: { schema_name: schema, ...dataConnection },
                    },
                    {
                      id: `fns_${connection.id}:${schema}`,
                      label: t('tabs.functions'),
                      childs: functionsSchema,
                      icon: 'functions',
                    },
                  ].filter(Boolean) as IItemTreeView[],
                };
              }) || []
            : [];

          if (filterTextSerialized) {
            schemasThreeView = schemasThreeView.filter((schema) =>
              schema.childs.some((group) => group.childs?.length),
            );
          }

          hasContentWithFilterText =
            hasContentWithFilterText ||
            !!databaseObjectsThreeView.length ||
            !!functionsThreeView.length;

          return {
            id: connection.id,
            label: connection.description,
            labelInfo:
              dialect.connectionMode === 'file'
                ? connection.database
                : dialect.connectionMode === 'react-native-bridge'
                  ? connection.reactNativeBridge?.appName || connection.reactNativeBridge?.appId
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
              !dialect.supportsSchemas &&
                !!viewsThreeView.length && {
                  id: `views_${connection.id}`,
                  type: 'views',
                  label: t('tabs.views'),
                  childs: viewsThreeView,
                  data: dataConnection,
                },
              !dialect.supportsSchemas &&
                !!materializedViewsThreeView.length && {
                  id: `mat_views_${connection.id}`,
                  type: 'materializedViews',
                  label: t('tabs.materializedViews'),
                  childs: materializedViewsThreeView,
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

  const treeViewItems = React.useMemo(() => {
    return filterTextSerialized
      ? projectsSerialized.filter((project) => project.hasContentWithFilterText)
      : projectsSerialized;
  }, [filterTextSerialized, projectsSerialized]);

  return {
    connectionsGroupPerProject,
    connectionsInfo,
    scriptsByConnectionId,
    projectsSerialized,
    treeViewItems,
  };
};
