import type { IItemTreeView, IItemTreeViewData } from '@renderer/components/TreeView';
import type { ITable, IFunctionDb } from '@shared/types/database';
import type { IScriptMetadata } from '@shared/types/workspace';

interface ProjectTreeData extends Partial<ITable>, Partial<IFunctionDb> {
  id_project?: string;
  id_connection?: string;
  description_connection?: string;
  schema_name?: string;
  script?: IScriptMetadata;
}

export type ProjectTreeItem = IItemTreeView<ProjectTreeData>;
export type ProjectTreeItemData = IItemTreeViewData<ProjectTreeData>;
