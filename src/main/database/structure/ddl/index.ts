import type {
  PrepareStructureDdlRequest, PreparedStructureDdl, StructureDdlDiagnostic,
  StructureColumn, StructureChanges, StructureAlterChanges, StructureRestriction,
} from '@shared/types/databaseDdl';
import { getDialectAdapter } from '../../dialects';
import { generateCreateTableDdl, generatePendingTableChangesDdl, generateAddColumnsDdl,
  generateReferencesDdl, generateRestrictionsDdl, getDdlHelpers } from './compiler';
import type { StructureDialect } from './types';

const normalized = (value?: string) => value?.trim() || '';
const finish = (sql: string): PreparedStructureDdl =>
  sql.trim() ? { status: 'ready', sql } : { status: 'empty' };

// Stateless/offline. No catalog lookup, connection or SQL execution.
export const prepareStructureDdl = (request: PrepareStructureDdlRequest): PreparedStructureDdl => {
  const diagnostics: StructureDdlDiagnostic[] = [];
  const issue = (
    object: StructureDdlDiagnostic['object'],
    name: string,
    operation: StructureDdlDiagnostic['operation'],
    field?: StructureDdlDiagnostic['field'],
    code: StructureDdlDiagnostic['code'] = 'unsupported-operation',
  ) => {
    diagnostics.push({ code, object, name, operation, ...(field ? { field } : {}) });
  };
  const blocked = (): PreparedStructureDdl => ({
    status: 'blocked',
    diagnostics: diagnostics as [StructureDdlDiagnostic, ...StructureDdlDiagnostic[]],
  });
  const adapter = getDialectAdapter(request.policyId);
  const sqlite = request.policyId === 'sqlite' || request.policyId === 'react-native-sqlite';
  const mysql = request.policyId === 'mysql';
  const dialect: StructureDialect = {
    ddl: adapter.structureDdl,
    quoteIdent: adapter.quoteIdentifier,
    getQualifiedName: (schema, table) =>
      schema
        ? `${adapter.quoteIdentifier(schema)}.${adapter.quoteIdentifier(table)}`
        : adapter.quoteIdentifier(table),
  };
  const helpers = getDdlHelpers(dialect);
  const typeDefinition = (column: StructureColumn) =>
    dialect.ddl.getColumnDefinitionDdl(
      {
        ...column,
        column_name: '__type',
        is_nullable: true,
        is_auto_increment: false,
        column_default: undefined,
      },
      helpers,
    );
  const checkColumn = (column: StructureColumn) => {
    if (!column.column_name.trim())
      issue('column', column.column_name, 'create', 'name', 'incomplete-intent');
    if (!column.data_type.trim())
      issue('column', column.column_name, 'create', 'type', 'incomplete-intent');
    if (column.is_auto_increment && normalized(column.column_default))
      issue('column', column.column_name, 'create', 'default');
    if (column.is_auto_increment && column.is_nullable)
      issue('column', column.column_name, 'create', 'nullable');
    if (column.is_auto_increment && !mysql)
      issue('column', column.column_name, 'create', 'auto-increment');
    if (
      column.is_auto_increment &&
      adapter.columnEditing &&
      !adapter.columnEditing.canUseAutoIncrement(column.data_type)
    )
      issue('column', column.column_name, 'create', 'auto-increment');
    if (normalized(column.description) && (sqlite || mysql))
      issue('column', column.column_name, 'comment', 'comment');
  };
  const checkRestriction = (restriction: StructureRestriction, addingToExisting: boolean) => {
    if (!restriction.constraint_name.trim())
      issue('restriction', restriction.constraint_name, 'create', 'name', 'incomplete-intent');
    if (
      ['primary_key', 'unique_key'].includes(restriction.constraint_type) &&
      (!restriction.column_names?.length || restriction.column_names.some((name) => !name.trim()))
    )
      issue(
        'restriction',
        restriction.constraint_name,
        'create',
        'constraint',
        'incomplete-intent',
      );
    if ((sqlite && addingToExisting) || restriction.constraint_type === 'exclusion')
      issue('restriction', restriction.constraint_name, 'create', 'constraint');
    if (
      restriction.constraint_type !== 'primary_key' &&
      restriction.constraint_type !== 'unique_key' &&
      !restriction.expression?.trim()
    ) {
      issue(
        'restriction',
        restriction.constraint_name,
        'create',
        'constraint',
        'incomplete-intent',
      );
    }
    if (restriction.comment)
      issue('restriction', restriction.constraint_name, 'comment', 'comment');
  };
  const checkChanges = (changes: StructureChanges, altering: boolean) => {
    changes.columns.forEach(checkColumn);
    if (sqlite && !altering && normalized(changes.tableComment))
      issue('table', request.target.table, 'comment', 'comment');
    const autoKeys = new Map<string, StructureRestriction[]>();
    for (const restriction of changes.restrictions || []) {
      checkRestriction(restriction, altering);
      if (
        ['primary_key', 'unique_key'].includes(restriction.constraint_type) &&
        restriction.column_names?.length === 1
      ) {
        const name = restriction.column_names[0];
        let keys = autoKeys.get(name);
        if (!keys) {
          keys = [];
          autoKeys.set(name, keys);
        }
        keys.push(restriction);
      }
    }
    // Legacy ADD embeds only the first auto key. Do not silently drop additional keys.
    if (altering && mysql) {
      const names = new Set(
        changes.columns
          .filter((column) => column.is_auto_increment)
          .map((column) => column.column_name),
      );
      for (const name of names)
        for (const key of (autoKeys.get(name) || []).slice(1))
          issue('restriction', key.constraint_name, 'create', 'constraint');
    }
    for (const reference of changes.references || []) {
      if (sqlite) issue('reference', reference.constraint_name, 'create', 'constraint');
      if (
        ![
          reference.constraint_name,
          reference.column_name,
          reference.reference_table_name,
          reference.reference_column_name,
        ].every((value) => value?.trim())
      )
        issue('reference', reference.constraint_name, 'create', 'constraint', 'incomplete-intent');
    }
    for (const index of changes.indexes || []) {
      if (
        !index.index_name.trim() ||
        !index.column_names?.length ||
        index.column_names.some((name) => !name.trim())
      )
        issue('index', index.index_name, 'create', 'index', 'incomplete-intent');
      if (index.is_unique || index.is_primary || (sqlite && index.index_method))
        issue('index', index.index_name, 'create', 'index');
    }
  };
  if (!request.target.table.trim())
    issue('table', request.target.table, 'create', 'name', 'incomplete-intent');
  if (request.type === 'references' || request.type === 'restrictions') {
    const items = request.type === 'references' ? request.references : request.restrictions;
    // FK dedup keeps the first selected row, including a full compound definition.
    const first = new Map<string, (typeof items)[number]>();
    for (const item of items)
      if (!first.has(item.constraint_name)) first.set(item.constraint_name, item);
    const selected = request.type === 'references' ? [...first.values()] : items;
    for (const item of selected) {
      if (!item.constraint_definition?.trim())
        issue(
          request.type === 'references' ? 'reference' : 'restriction',
          item.constraint_name,
          'definition',
          'definition',
          'missing-definition',
        );
      else if (sqlite)
        issue(
          request.type === 'references' ? 'reference' : 'restriction',
          item.constraint_name,
          'create',
          'constraint',
        );
      if (mysql && item.comment)
        issue(
          request.type === 'references' ? 'reference' : 'restriction',
          item.constraint_name,
          'comment',
          'comment',
        );
    }
    if (diagnostics.length) return blocked();
    return finish(
      request.type === 'references'
        ? generateReferencesDdl(
            dialect,
            request.target.schema,
            request.target.table,
            request.references,
          )
        : generateRestrictionsDdl(
            dialect,
            request.target.schema,
            request.target.table,
            request.restrictions,
          ),
    );
  }
  if (request.type === 'add-columns') {
    request.columns.forEach(checkColumn);
    const autoColumns = new Set(
      request.columns
        .filter((column) => column.is_auto_increment)
        .map((column) => column.column_name),
    );
    const embedded = new Set<string>();
    const embeddedKeys = new Set<StructureRestriction>();
    for (const restriction of request.restrictions) {
      if (
        mysql &&
        ['primary_key', 'unique_key'].includes(restriction.constraint_type) &&
        restriction.column_names?.length === 1 &&
        autoColumns.has(restriction.column_names[0])
      ) {
        if (embedded.has(restriction.column_names[0]))
          issue('restriction', restriction.constraint_name, 'create', 'constraint');
        else embeddedKeys.add(restriction);
        embedded.add(restriction.column_names[0]);
      }
    }
    const selected = new Set(request.columns.map((column) => column.column_name));
    for (const restriction of request.restrictions) {
      if (embeddedKeys.has(restriction)) {
        checkRestriction(restriction, false);
        continue;
      }
      if (
        restriction.column_names?.length &&
        restriction.column_names.every((name) => selected.has(name))
      ) {
        if (!restriction.constraint_definition?.trim())
          issue(
            'restriction',
            restriction.constraint_name,
            'definition',
            'definition',
            'missing-definition',
          );
        if (sqlite) issue('restriction', restriction.constraint_name, 'create', 'constraint');
        if (mysql && restriction.comment)
          issue('restriction', restriction.constraint_name, 'comment', 'comment');
      }
    }
    const groups = new Map<string, typeof request.references>();
    for (const reference of request.references) {
      let group = groups.get(reference.constraint_name);
      if (!group) {
        group = [];
        groups.set(reference.constraint_name, group);
      }
      group.push(reference);
    }
    for (const group of groups.values())
      if (group.every((item) => selected.has(item.column_name))) {
        if (!group[0].constraint_definition?.trim())
          issue(
            'reference',
            group[0].constraint_name,
            'definition',
            'definition',
            'missing-definition',
          );
        if (sqlite) issue('reference', group[0].constraint_name, 'create', 'constraint');
        if (mysql && group[0].comment)
          issue('reference', group[0].constraint_name, 'comment', 'comment');
      }
    if (diagnostics.length) return blocked();
    return finish(
      generateAddColumnsDdl(
        dialect,
        request.target.schema,
        request.target.table,
        request.columns,
        request,
      ),
    );
  }
  checkChanges(request.changes, request.type === 'alter-table');
  if (request.type === 'create-table' && !request.changes.columns.length)
    issue('table', request.target.table, 'create', undefined, 'incomplete-intent');
  if (request.type === 'alter-table') {
    const changes: StructureAlterChanges = request.changes;
    for (const change of changes.changedColumns || []) {
      const { original, current } = change;
      const autoEnabled = Boolean(current.is_auto_increment) && !original.is_auto_increment;
      if (
        autoEnabled &&
        adapter.columnEditing &&
        !adapter.columnEditing.canUseAutoIncrement(current.data_type)
      ) {
        issue('column', current.column_name, 'alter', 'auto-increment');
      }
      if (
        mysql &&
        current.is_auto_increment &&
        current.is_nullable &&
        (autoEnabled || current.is_nullable !== original.is_nullable)
      )
        issue('column', current.column_name, 'alter', 'nullable');
      if (
        mysql &&
        current.is_auto_increment &&
        normalized(current.column_default) &&
        (autoEnabled || normalized(current.column_default) !== normalized(original.column_default))
      )
        issue('column', current.column_name, 'alter', 'default');
      if (
        mysql &&
        original.is_auto_increment &&
        current.is_auto_increment &&
        (typeDefinition(original) !== typeDefinition(current) ||
          original.is_nullable !== current.is_nullable ||
          normalized(original.column_default) !== normalized(current.column_default))
      )
        issue('column', current.column_name, 'alter', 'auto-increment');
      if (!current.column_name.trim())
        issue('column', current.column_name, 'alter', 'name', 'incomplete-intent');
      if (!current.data_type.trim())
        issue('column', current.column_name, 'alter', 'type', 'incomplete-intent');
      if (sqlite) {
        if (typeDefinition(original) !== typeDefinition(current))
          issue('column', current.column_name, 'alter', 'type');
        if (original.is_nullable !== current.is_nullable)
          issue('column', current.column_name, 'alter', 'nullable');
        if (normalized(original.column_default) !== normalized(current.column_default))
          issue('column', current.column_name, 'alter', 'default');
      }
      if (Boolean(original.is_auto_increment) !== Boolean(current.is_auto_increment) && !mysql)
        issue('column', current.column_name, 'alter', 'auto-increment');
      if (normalized(original.description) !== normalized(current.description) && (sqlite || mysql))
        issue('column', current.column_name, 'comment', 'comment');
    }
    for (const item of changes.droppedRestrictions || [])
      if (mysql && item.constraint_type === 'exclusion')
        issue('restriction', item.constraint_name, 'drop', 'constraint');
    if (mysql) {
      const dropped = new Set(changes.droppedColumns?.map((column) => column.column_name));
      for (const item of changes.existingRestrictions || [])
        if (
          item.constraint_type === 'exclusion' &&
          item.column_names?.some((name) => dropped.has(name))
        )
          issue('restriction', item.constraint_name, 'drop', 'constraint');
    }
    if (sqlite) {
      for (const item of [
        ...(changes.droppedRestrictions || []),
        ...(changes.droppedReferences || []),
      ])
        issue(
          'constraint_type' in item ? 'restriction' : 'reference',
          item.constraint_name,
          'drop',
          'constraint',
        );
      const dropped = new Set(changes.droppedColumns?.map((column) => column.column_name));
      for (const item of changes.existingRestrictions || [])
        if (item.column_names?.some((name) => dropped.has(name)))
          issue('restriction', item.constraint_name, 'drop', 'constraint');
      for (const item of changes.existingReferences || [])
        if (dropped.has(item.column_name))
          issue('reference', item.constraint_name, 'drop', 'constraint');
      if (changes.tableCommentChanged) issue('table', request.target.table, 'comment', 'comment');
    }
    if (changes.newTableName !== undefined && !changes.newTableName.trim())
      issue('table', changes.newTableName, 'alter', 'name', 'incomplete-intent');
    if (diagnostics.length) return blocked();
    return finish(
      generatePendingTableChangesDdl(dialect, request.target.schema, request.target.table, {
        ...changes,
        changedColumns: changes.changedColumns?.map(({ original, current }) => ({
          ...current,
          original,
        })),
      }),
    );
  }
  if (diagnostics.length) return blocked();
  return finish(
    generateCreateTableDdl(dialect, request.target.schema, request.target.table, request.changes),
  );
};
