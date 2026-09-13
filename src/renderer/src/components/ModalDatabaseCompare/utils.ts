import type { DatabaseObjectType, IFunctionDb, ITable } from '@renderer/contexts/Store';
import type { DatabaseCompareSelectableObject, ObjectGroup } from './types';

const getQualifiedLabel = (schema: string | undefined, name: string) =>
  [schema, name].filter(Boolean).join('.');

export const getObjectKey = (object: DatabaseCompareSelectableObject) =>
  `${object.type}\0${object.schema || ''}\0${object.name}\0${
    object.type === 'function' ? object.functionIdentityArguments || '' : ''
  }`;

export const getGroupKey = (group: Pick<ObjectGroup, 'schema' | 'label'>) =>
  group.schema || group.label;

export const mergeTables = (sourceTables: ITable[], targetTables: ITable[]) => {
  const byKey = new Map<string, ITable>();

  [...sourceTables, ...targetTables].forEach((table) => {
    const key = `table\0${table.table_schema || ''}\0${table.table_name}`;
    byKey.set(key, byKey.get(key) || table);
  });

  return [...byKey.values()].sort((a, b) =>
    getQualifiedLabel(a.table_schema, a.table_name).localeCompare(
      getQualifiedLabel(b.table_schema, b.table_name),
    ),
  );
};

export const mergeFunctions = (sourceFunctions: IFunctionDb[], targetFunctions: IFunctionDb[]) => {
  const byKey = new Map<string, IFunctionDb>();

  [...sourceFunctions, ...targetFunctions].forEach((fn) => {
    const key = `function\0${fn.function_schema || ''}\0${fn.function_name}\0${
      fn.function_identity_arguments || ''
    }`;
    byKey.set(key, byKey.get(key) || fn);
  });

  return [...byKey.values()].sort((a, b) =>
    getQualifiedLabel(a.function_schema, a.function_name).localeCompare(
      getQualifiedLabel(b.function_schema, b.function_name),
    ),
  );
};

export const groupObjects = (
  objects: DatabaseCompareSelectableObject[],
  supportsSchemas: boolean,
): ObjectGroup[] => {
  if (!supportsSchemas) return [{ label: 'databaseCompare.noSchema', objects }];

  const grouped = new Map<string, DatabaseCompareSelectableObject[]>();

  objects.forEach((object) => {
    const schema = object.schema || '';
    const schemaObjects = grouped.get(schema) || [];
    schemaObjects.push(object);
    grouped.set(schema, schemaObjects);
  });

  return [...grouped].map(([schema, schemaObjects]) => ({
    schema,
    label: schema || 'databaseCompare.noSchema',
    objects: schemaObjects,
  }));
};

export const filterObject = (object: DatabaseCompareSelectableObject, filterText: string) => {
  if (!filterText) return true;

  return getQualifiedLabel(object.schema, getObjectDisplayName(object))
    .toLowerCase()
    .includes(filterText.toLowerCase());
};

export const getObjectTypeLabel = (object: DatabaseCompareSelectableObject) => {
  if (object.type === 'function') return 'FUNCTION';

  const type = object.table.object_type as DatabaseObjectType | undefined;
  if (type === 'view') return 'VIEW';
  if (type === 'materialized_view') return 'MAT VIEW';
  return 'TABLE';
};

export const getObjectDisplayName = (object: DatabaseCompareSelectableObject) => {
  if (object.type !== 'function' || !object.functionIdentityArguments) return object.name;

  return `${object.name}(${object.functionIdentityArguments})`;
};
