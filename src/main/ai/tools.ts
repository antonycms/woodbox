import { isStepCount, jsonSchema, type Schema, type ToolSet, tool } from 'ai';
import {
  getConnectionInfo,
  getFunctionDefinition,
  getTableColumns,
  getTableIndexes,
  getTableReferences,
  getTableRestrictions,
  getTableRowsCount,
  runExplainSql,
} from '@main/database/core';
import { getConnectionsSaved } from '@main/storage/store';

const aiToolSchema = <T extends object>(schema: Parameters<typeof jsonSchema>[0]): Schema<T> =>
  jsonSchema<T>(schema);

type AIConnectionContext = {
  id: string;
  description: string;
  dialect: Dialect;
  database: string;
  host: string;
  port: number;
  environment?: ConnectionEnvironment;
};

type AITableToolInput = {
  connection: string;
  table: string;
  schema?: string;
};


type AIFunctionDefinitionInput = {
  connection: string;
  functionName: string;
  schema?: string;
};

type AIQueryExecutionInput = {
  connection: string;
  query: string;
  reason?: string;
  limit?: number;
};

type AIExplainQueryPlanInput = {
  connection: string;
  query: string;
};

export type AIQueryExecutionToolOutput = {
  queryApproval: IAIQueryApproval;
  reason?: string;
};

type AIToolContext = Record<string, unknown>;

export const AI_QUERY_EXECUTION_TOOL_NAME = 'request_query_execution';

const normalizeMention = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const compactMention = (value: string) => normalizeMention(value).replace(/-/g, '');

const isEmptyAIValue = (value: unknown) => {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return !value.length;
  if (typeof value === 'object') return !Object.keys(value).length;

  return false;
};

const compactForAI = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(compactForAI).filter((item) => !isEmptyAIValue(item));
  }

  if (!value || typeof value !== 'object') return value;

  const entries = Object.entries(value)
    .map(([key, item]) => [key, compactForAI(item)] as const)
    .filter(([, item]) => !isEmptyAIValue(item));

  return Object.fromEntries(entries);
};

const summarizeRows = (rows: unknown[], limit: number) => ({
  items: rows.slice(0, limit).map(compactForAI),
  total: rows.length,
  truncated: rows.length > limit,
});

const compactColumnForAI = (column: unknown) => {
  if (!column || typeof column !== 'object' || Array.isArray(column)) return column;

  const { udt_name, data_type, ...rest } = column as Record<string, unknown>;

  if (udt_name === data_type) return { data_type, ...rest };

  return column;
};

const getObjectSchemaKey = (schema: unknown) => String(schema || 'default');

const addGroupedObjectName = (
  groups: Record<string, string[]>,
  key: string,
  name: unknown,
) => {
  if (typeof name !== 'string' || !name) return;

  groups[key] ||= [];
  groups[key].push(name);
};

const getTableObjectGroup = (objectType: unknown) => {
  if (objectType === 'view') return 'views';
  if (objectType === 'materialized_view') return 'materialized_views';

  return 'tables';
};

const groupConnectionObjects = (
  tables: Record<string, unknown>[],
  functions: Record<string, unknown>[],
) => {
  const groups: Record<string, string[]> = {};

  for (const table of tables) {
    const schema = getObjectSchemaKey(table.table_schema);
    const group = getTableObjectGroup(table.object_type);

    addGroupedObjectName(groups, `${schema}.${group}`, table.table_name);
  }

  for (const fn of functions) {
    const schema = getObjectSchemaKey(fn.function_schema);

    addGroupedObjectName(groups, `${schema}.functions`, fn.function_name);
  }

  return groups;
};

const getPublicConnections = (): AIConnectionContext[] =>
  getConnectionsSaved().map((connection) => ({
    id: connection.id,
    description: connection.description,
    dialect: connection.dialect,
    database: connection.database,
    host: connection.host,
    port: connection.port,
    environment: connection.environment,
  }));

const getAllowedConnectionIds = (mentionedConnectionIds?: string[]) =>
  new Set((mentionedConnectionIds || []).filter(Boolean));

const resolveConnection = (value: string, mentionedConnectionIds?: string[]) => {
  const connections = getPublicConnections();
  const allowedConnectionIds = getAllowedConnectionIds(mentionedConnectionIds);
  const normalizedValue = normalizeMention(value);
  const compactValue = compactMention(value);

  const connection = connections.find((item) => {
    if (item.id === value) return true;
    if (normalizeMention(item.description) === normalizedValue) return true;
    if (compactMention(item.description) === compactValue) return true;
    if (normalizeMention(item.database) === normalizedValue) return true;
    if (compactMention(item.database) === compactValue) return true;

    return false;
  });

  if (!connection) {
    throw new Error(`Conexão não encontrada: ${value}`);
  }

  if (allowedConnectionIds.size && !allowedConnectionIds.has(connection.id)) {
    throw new Error(
      `A conexão "${connection.description}" não foi selecionada pelo usuário nesta mensagem.`,
    );
  }

  return connection;
};

const getKnownObjects = async (connectionId: string) => {
  const info = await getConnectionInfo(connectionId);

  return {
    ...info,
    tables: info.tables || [],
    functions: info.functions || [],
  };
};

const assertTableExists = async (connectionId: string, table: string, schema?: string) => {
  const info = await getKnownObjects(connectionId);
  const normalizedTable = table.toLowerCase();
  const normalizedSchema = schema?.toLowerCase();
  const found = info.tables.find((item) => {
    const tableMatches = String(item.table_name || '').toLowerCase() === normalizedTable;
    const schemaMatches =
      !normalizedSchema || String(item.table_schema || '').toLowerCase() === normalizedSchema;

    return tableMatches && schemaMatches;
  });

  if (!found) {
    throw new Error(`Tabela não encontrada: ${schema ? `${schema}.` : ''}${table}`);
  }

  return {
    table: String(found.table_name),
    schema: found.table_schema ? String(found.table_schema) : schema,
  };
};

const assertFunctionExists = async (connectionId: string, functionName: string, schema?: string) => {
  const info = await getKnownObjects(connectionId);
  const normalizedFunction = functionName.toLowerCase();
  const normalizedSchema = schema?.toLowerCase();
  const found = info.functions.find((item) => {
    const functionMatches = String(item.function_name || '').toLowerCase() === normalizedFunction;
    const schemaMatches =
      !normalizedSchema || String(item.function_schema || '').toLowerCase() === normalizedSchema;

    return functionMatches && schemaMatches;
  });

  if (!found) {
    throw new Error(`Função não encontrada: ${schema ? `${schema}.` : ''}${functionName}`);
  }

  return {
    functionName: String(found.function_name),
    schema: found.function_schema ? String(found.function_schema) : schema,
  };
};

const connectionSchema = {
  type: 'object',
  properties: {
    connection: {
      type: 'string',
      description: 'ID, nome ou menção da conexão, por exemplo @producao.',
    },
  },
  required: ['connection'],
  additionalProperties: false,
} as const;

const tableSchema = {
  type: 'object',
  properties: {
    connection: {
      type: 'string',
      description: 'ID, nome ou menção da conexão.',
    },
    table: { type: 'string', description: 'Nome da tabela.' },
    schema: { type: 'string', description: 'Schema da tabela, quando existir.' },
  },
  required: ['connection', 'table'],
  additionalProperties: false,
} as const;

const queryExecutionSchema = {
  type: 'object',
  properties: {
    connection: {
      type: 'string',
      description: 'ID, nome ou menção da conexão selecionada pelo usuário.',
    },
    query: {
      type: 'string',
      description: 'Uma única query SQL proposta para execução.',
    },
    reason: {
      type: 'string',
      description: 'Motivo curto para solicitar a execução da query.',
    },
    limit: {
      type: 'number',
      description: 'Limite de linhas para exibição do resultado. Use 200 por padrão.',
    },
  },
  required: ['connection', 'query'],
  additionalProperties: false,
} as const;

const explainQueryPlanSchema = {
  type: 'object',
  properties: {
    connection: {
      type: 'string',
      description: 'ID, nome ou menção da conexão selecionada pelo usuário.',
    },
    query: {
      type: 'string',
      description: 'Uma única query SELECT/WITH para analisar com EXPLAIN.',
    },
  },
  required: ['connection', 'query'],
  additionalProperties: false,
} as const;

export const getAIConnectionContexts = (mentionedConnectionIds?: string[]) => {
  const connections = getPublicConnections();
  const mentionedIds = getAllowedConnectionIds(mentionedConnectionIds);

  return {
    connections,
    mentionedConnections: mentionedIds.size
      ? connections.filter((connection) => mentionedIds.has(connection.id))
      : [],
  };
};

export const buildAIDatabaseInstructions = (mentionedConnectionIds?: string[]) => {
  const { connections, mentionedConnections } = getAIConnectionContexts(mentionedConnectionIds);
  const connectionLines = connections.length
    ? connections
        .map(
          (connection) =>
            `- id=${connection.id}; nome="${connection.description}"; dialect=${connection.dialect}; database=${connection.database}; host=${connection.host}; port=${connection.port}; env=${connection.environment || 'n/a'}`,
        )
        .join('\n')
    : '- nenhuma conexão configurada';
  const mentionedLines = mentionedConnections.length
    ? mentionedConnections
        .map((connection) => `- id=${connection.id}; nome="${connection.description}"`)
        .join('\n')
    : '- nenhuma conexão selecionada nesta mensagem';

  return [
    'Conexões disponíveis para ferramentas de banco:',
    connectionLines,
    '',
    'Conexão selecionada pelo usuário para esta mensagem:',
    mentionedLines,
    '',
    'Use a conexão selecionada como contexto padrão para ferramentas de banco.',
    'O usuário pode referenciar tabelas com @tabela ou @schema.tabela; trate isso como tabela da conexão selecionada.',
    'Antes de responder sobre tabelas, schemas ou funções, use as ferramentas disponíveis.',
    'Você não tem ferramenta para visualizar linhas ou valores das tabelas diretamente sem aprovação do usuário.',
    'Não invente metadados. Se a conexão/tabela/função não existir, diga isso.',
    'Você tem a ferramenta request_query_execution para propor uma query que precisa de execução.',
    'Quando precisar consultar dados, chame request_query_execution com uma única query e explique brevemente o motivo.',
    'Para alterar dados ou estrutura, chame request_query_execution apenas se o usuário pedir explicitamente a alteração.',
    'Se o usuário pedir análise de performance ou plano de execução de uma query SELECT/WITH, use explain_query_plan.',
    'Não escreva blocos ```sql``` para execução; a interface exibirá o card de aprovação.',
    'Se o usuário pedir apenas para revisar, explicar, otimizar ou melhorar uma query, use explain_query_plan quando o plano real ajudar; caso contrário responda com sugestões e SQL de exemplo sem pedir confirmação de execução.',
    'Não peça para o usuário digitar "confirmar" ou "rejeitar"; a interface exibirá botões.',
    'Quando receber uma mensagem informando que a query JÁ FOI APROVADA e JÁ FOI EXECUTADA, não chame request_query_execution para a mesma SQL; responda diretamente com base no JSON retornado.',
  ].join('\n');
};

export const createAIDatabaseTools = (mentionedConnectionIds?: string[]): ToolSet => ({
  list_connections: tool({
    description: 'Lista conexões disponíveis, sem credenciais, em formato compacto.',
    inputSchema: aiToolSchema<Record<string, never>>({
      type: 'object',
      properties: {},
      additionalProperties: false,
    }),
    execute: async () => ({
      connections: getPublicConnections().map((connection) =>
        compactForAI({
          id: connection.id,
          name: connection.description,
          dialect: connection.dialect,
          database: connection.database,
          env: connection.environment,
        }),
      ),
    }),
  }),

  get_connection_info: tool({
    description:
      'Lista objetos da conexão agrupados por chave: schema.tables, schema.views, schema.materialized_views e schema.functions.',
    inputSchema: aiToolSchema<{ connection: string }>(connectionSchema),
    execute: async ({ connection }) => {
      const resolved = resolveConnection(connection, mentionedConnectionIds);
      const info = await getKnownObjects(resolved.id);

      return {
        objects: groupConnectionObjects(info.tables, info.functions),
      };
    },
  }),

  search_database_objects: tool({
    description:
      'Busca tabelas e funções por nome e retorna objetos agrupados por schema.tables/schema.views/schema.functions, limitado a 50 por tipo.',
    inputSchema: aiToolSchema<{
      connection: string;
      query: string;
      objectType?: 'all' | 'table' | 'function';
    }>({
      type: 'object',
      properties: {
        connection: { type: 'string' },
        query: { type: 'string' },
        objectType: { type: 'string', enum: ['all', 'table', 'function'] },
      },
      required: ['connection', 'query'],
      additionalProperties: false,
    }),
    execute: async ({ connection, query, objectType = 'all' }) => {
      const resolved = resolveConnection(connection, mentionedConnectionIds);
      const info = await getKnownObjects(resolved.id);
      const normalizedQuery = query.trim().toLowerCase();
      const matchedTables =
        objectType === 'function'
          ? []
          : info.tables.filter((table) =>
              [table.table_schema, table.table_name]
                .filter(Boolean)
                .join('.')
                .toLowerCase()
                .includes(normalizedQuery),
            );
      const matchedFunctions =
        objectType === 'table'
          ? []
          : info.functions.filter((fn) =>
              [fn.function_schema, fn.function_name]
                .filter(Boolean)
                .join('.')
                .toLowerCase()
                .includes(normalizedQuery),
            );

      return {
        objects: groupConnectionObjects(
          matchedTables.slice(0, 50),
          matchedFunctions.slice(0, 50),
        ),
        total: {
          tables: matchedTables.length,
          functions: matchedFunctions.length,
        },
        truncated: {
          tables: matchedTables.length > 50,
          functions: matchedFunctions.length > 50,
        },
      };
    },
  }),

  get_table_schema: tool<AITableToolInput, unknown, AIToolContext>({
    description:
      'Carrega metadados resumidos de uma tabela. Retorna listas {items,total,truncated}; omite DDL/triggers.',
    inputSchema: aiToolSchema<AITableToolInput>(tableSchema),
    execute: async ({ connection, table, schema }) => {
      const resolved = resolveConnection(connection, mentionedConnectionIds);
      const tableRef = await assertTableExists(resolved.id, table, schema);
      const [columns, references, restrictions, indexes, rowsCount] =
        await Promise.all([
          getTableColumns(resolved.id, tableRef),
          getTableReferences(resolved.id, tableRef),
          getTableRestrictions(resolved.id, tableRef),
          getTableIndexes(resolved.id, tableRef),
          getTableRowsCount(resolved.id, tableRef),
        ]);

      return {
        table: tableRef,
        rowsCount,
        columns: summarizeRows(columns.map(compactColumnForAI), 80),
        references: summarizeRows(references, 40),
        restrictions: summarizeRows(restrictions, 40),
        indexes: summarizeRows(indexes, 40),
        omitted: {
          definition: true,
          triggers: true,
          usedAsReference: true,
        },
      };
    },
  }),

  get_function_definition: tool<AIFunctionDefinitionInput, unknown, AIToolContext>({
    description: 'Carrega a definição de uma função/procedure quando o dialeto suportar.',
    inputSchema: aiToolSchema<AIFunctionDefinitionInput>({
      type: 'object',
      properties: {
        connection: { type: 'string' },
        functionName: { type: 'string' },
        schema: { type: 'string' },
      },
      required: ['connection', 'functionName'],
      additionalProperties: false,
    }),
    execute: async ({ connection, functionName, schema }) => {
      const resolved = resolveConnection(connection, mentionedConnectionIds);
      const functionRef = await assertFunctionExists(resolved.id, functionName, schema);
      const definition = await getFunctionDefinition(resolved.id, {
        ...functionRef,
        schema: functionRef.schema || '',
      });

      return {
        function: functionRef,
        definition,
      };
    },
  }),

  explain_query_plan: tool<AIExplainQueryPlanInput, unknown, AIToolContext>({
    description:
      'Executa EXPLAIN seguro para uma única query SELECT/WITH e retorna o plano de execução.',
    inputSchema: aiToolSchema<AIExplainQueryPlanInput>(explainQueryPlanSchema),
    execute: async ({ connection, query }) => {
      const resolved = resolveConnection(connection, mentionedConnectionIds);
      const explain = await runExplainSql(resolved.id, query);

      return {
        dialect: resolved.dialect,
        query: query.trim(),
        explain: compactForAI(explain),
      };
    },
  }),

  [AI_QUERY_EXECUTION_TOOL_NAME]: tool<AIQueryExecutionInput, AIQueryExecutionToolOutput, AIToolContext>({
    description:
      'Solicita aprovação do usuário para executar uma única query SQL.',
    inputSchema: aiToolSchema<AIQueryExecutionInput>(queryExecutionSchema),
    execute: async ({ connection, query, reason, limit = 200 }) => {
      const resolved = resolveConnection(connection, mentionedConnectionIds);

      return {
        reason,
        queryApproval: {
          id: crypto.randomUUID(),
          connectionId: resolved.id,
          connectionName: resolved.description,
          dialect: resolved.dialect,
          database: resolved.database,
          sql: query.trim().replace(/;+\s*$/, ''),
          limit,
          status: 'pending',
        },
      };
    },
  }),
});

export const AI_TOOL_STOP_CONDITION = isStepCount(6);
