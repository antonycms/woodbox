import type {
  DatabaseCompareItemDisplay,
  DatabaseCompareItem,
  DatabaseCompareKind,
} from '@shared/types/databaseCompare';
import type { Row } from './types';

export const normalizeName = (value: string | undefined, ignoreCase?: boolean) => {
  const normalized = value || '';
  return ignoreCase ? normalized.toLowerCase() : normalized;
};

export const objectKey = (schema: string | undefined, name: string, ignoreCase?: boolean) =>
  `${schema || ''}\0${normalizeName(name, ignoreCase)}`;

export const functionKey = (schema: string | undefined, name: string, identityArguments?: string) =>
  `${schema || ''}\0${name}\0${identityArguments || ''}`;

export const qualifiedName = (
  quoteIdentifier: (value: string) => string,
  schema: string | undefined,
  name: string,
) => (schema ? `${quoteIdentifier(schema)}.${quoteIdentifier(name)}` : quoteIdentifier(name));

export const endpoint = (schema: string | undefined, name: string, parentName?: string) => ({
  schema,
  name,
  parentName,
});

export const display = (
  schema: string | undefined,
  name: string,
  parentName?: string,
  targetName?: string,
): DatabaseCompareItemDisplay => ({
  schema,
  name,
  parentName,
  targetName,
});

export const normalizeSql = (value: unknown) =>
  String(value || '')
    .trim()
    .replace(/;$/g, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();

export const normalizeOptional = (value: unknown) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

export const parseArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  if (value === undefined || value === null || value === '') return [];

  const text = String(value);

  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      return [];
    }
  }

  return text.split(',').map((item) => item.trim()).filter(Boolean);
};

export const normalizeIdentifierList = (value: unknown, ignoreCase?: boolean) =>
  parseArray(value).map((item) => normalizeName(item, ignoreCase));

export const normalizeForCompare = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeForCompare);
  if (!value || typeof value !== 'object') return value ?? '';

  const source = value as Row;
  return Object.keys(source)
    .sort()
    .reduce<Row>((acc, key) => {
      acc[key] = normalizeForCompare(source[key]);
      return acc;
    }, {});
};

export const stableStringify = (value: unknown) => JSON.stringify(normalizeForCompare(value));

export const pushSemicolon = (sql: string) => {
  const text = sql.trim();
  if (!text) return '';
  return text.endsWith(';') ? text : `${text};`;
};

export const MAX_METADATA_CONCURRENCY = 6;

export const mapWithConcurrency = async <T>(
  items: T[],
  mapper: (item: T, index: number) => Promise<void>,
  concurrency = MAX_METADATA_CONCURRENCY,
) => {
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
};


export const makeItemFactory = () => {
  let index = 0;

  return (item: Omit<DatabaseCompareItem, 'id'>): DatabaseCompareItem => ({
    ...item,
    id: `diff_${++index}`,
  });
};


export const compareNamedList = <T extends Row>(params: {
  items: DatabaseCompareItem[];
  addItem: ReturnType<typeof makeItemFactory>;
  sourceRows: T[];
  targetRows: T[];
  getName(row: T): string;
  getSignature(row: T): string;
  getLabelName?(row: T, name: string): string;
  getDisplay?(row: T, name: string): DatabaseCompareItemDisplay;
  getKind?(row: T): DatabaseCompareKind;
  createDdl(row: T): string;
  deleteDdl(row: T): string;
  kind: DatabaseCompareKind;
  schema?: string;
  parentName?: string;
  enableRollback: boolean;
}) => {
  const sourceByName = new Map(params.sourceRows.map((row) => [params.getName(row), row]));
  const targetByName = new Map(params.targetRows.map((row) => [params.getName(row), row]));
  const names = new Set([...sourceByName.keys(), ...targetByName.keys()]);

  names.forEach((name) => {
    const source = sourceByName.get(name);
    const target = targetByName.get(name);
    const getDisplay = (row: T) => {
      const displayName = params.getLabelName ? params.getLabelName(row, name) : name;
      return params.getDisplay?.(row, name) || display(params.schema, displayName, params.parentName);
    };

    if (source && !target) {
      const itemDisplay = getDisplay(source);
      params.items.push(
        params.addItem({
          operation: 'create',
          kind: params.getKind?.(source) || params.kind,
          display: itemDisplay,
          source: endpoint(itemDisplay.schema, itemDisplay.name || name, itemDisplay.parentName),
          ddl: params.createDdl(source),
          rollbackDdl: params.enableRollback ? params.deleteDdl(source) : undefined,
        }),
      );
      return;
    }

    if (!source && target) {
      const itemDisplay = getDisplay(target);
      params.items.push(
        params.addItem({
          operation: 'delete',
          kind: params.getKind?.(target) || params.kind,
          display: itemDisplay,
          target: endpoint(itemDisplay.schema, itemDisplay.name || name, itemDisplay.parentName),
          ddl: params.deleteDdl(target),
          rollbackDdl: params.enableRollback ? params.createDdl(target) : undefined,
        }),
      );
      return;
    }

    if (source && target && params.getSignature(source) !== params.getSignature(target)) {
      const sourceDisplay = getDisplay(source);
      const targetDisplay = getDisplay(target);
      params.items.push(
        params.addItem({
          operation: 'modify',
          kind: params.getKind?.(source) || params.kind,
          display: sourceDisplay,
          source: endpoint(sourceDisplay.schema, sourceDisplay.name || name, sourceDisplay.parentName),
          target: endpoint(targetDisplay.schema, targetDisplay.name || name, targetDisplay.parentName),
          ddl: [params.deleteDdl(target), params.createDdl(source)].filter(Boolean).join('\n\n'),
          rollbackDdl: params.enableRollback
            ? [params.deleteDdl(source), params.createDdl(target)].filter(Boolean).join('\n\n')
            : undefined,
        }),
      );
    }
  });
};


export type CompareItemFactory = ReturnType<typeof makeItemFactory>;
