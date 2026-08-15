import { isStepCount, jsonSchema, type Schema, type ToolSet, tool } from 'ai';
import {
  getConnectionInfo,
  getFunctionDefinition,
  getTableColumns,
  getTableDefinition,
  getTableIndexes,
  getTableReferences,
  getTableRestrictions,
  getTableRowsCount,
  getTableTriggers,
  getTableUsedAsReference,
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

type AIToolContext = Record<string, unknown>;

const normalizeMention = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const compactMention = (value: string) => normalizeMention(value).replace(/-/g, '');

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

const serializeConnectionForAI = (connection: AIConnectionContext) => ({
  id: connection.id,
  name: connection.description,
  dialect: connection.dialect,
  database: connection.database,
  host: connection.host,
  port: connection.port,
  environment: connection.environment,
});

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
    'Conexões disponíveis para ferramentas read-only:',
    connectionLines,
    '',
    'Conexão selecionada pelo usuário para esta mensagem:',
    mentionedLines,
    '',
    'Use a conexão selecionada como contexto padrão para ferramentas de banco.',
    'O usuário pode referenciar tabelas com @tabela ou @schema.tabela; trate isso como tabela da conexão selecionada.',
    'Antes de responder sobre tabelas, schemas ou funções, use as ferramentas disponíveis.',
    'Você não tem ferramenta para visualizar linhas ou valores das tabelas diretamente.',
    'Não invente metadados. Se a conexão/tabela/função não existir, diga isso.',
    'Você não tem ferramenta para executar query. Quando precisar consultar dados, escreva a query em um único bloco ```sql``` e aguarde a confirmação por botões da interface.',
    'Não peça para o usuário digitar "confirmar" ou "rejeitar"; a interface exibirá botões.',
    'Quando receber uma mensagem informando que a query JÁ FOI APROVADA e JÁ FOI EXECUTADA, não peça nova confirmação e não repita a SQL; responda diretamente com base no JSON retornado.',
  ].join('\n');
};

export const createAIDatabaseTools = (mentionedConnectionIds?: string[]): ToolSet => ({
  list_connections: tool({
    description: 'Lista conexões disponíveis, sem credenciais.',
    inputSchema: aiToolSchema<Record<string, never>>({
      type: 'object',
      properties: {},
      additionalProperties: false,
    }),
    execute: async () => ({
      connections: getPublicConnections().map(serializeConnectionForAI),
    }),
  }),

  get_connection_info: tool({
    description: 'Lista schemas, tabelas e funções de uma conexão.',
    inputSchema: aiToolSchema<{ connection: string }>(connectionSchema),
    execute: async ({ connection }) => {
      const resolved = resolveConnection(connection, mentionedConnectionIds);
      const info = await getKnownObjects(resolved.id);

      return {
        connection: serializeConnectionForAI(resolved),
        schemas: info.schemas || [],
        tables: info.tables,
        functions: info.functions,
      };
    },
  }),

  search_database_objects: tool({
    description: 'Busca tabelas e funções por nome em uma conexão.',
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

      return {
        connection: serializeConnectionForAI(resolved),
        tables:
          objectType === 'function'
            ? []
            : info.tables
                .filter((table) =>
                  [table.table_schema, table.table_name]
                    .filter(Boolean)
                    .join('.')
                    .toLowerCase()
                    .includes(normalizedQuery),
                )
                .slice(0, 50),
        functions:
          objectType === 'table'
            ? []
            : info.functions
                .filter((fn) =>
                  [fn.function_schema, fn.function_name]
                    .filter(Boolean)
                    .join('.')
                    .toLowerCase()
                    .includes(normalizedQuery),
                )
                .slice(0, 50),
      };
    },
  }),

  get_table_schema: tool<AITableToolInput, unknown, AIToolContext>({
    description: 'Carrega metadados completos de uma tabela.',
    inputSchema: aiToolSchema<AITableToolInput>(tableSchema),
    execute: async ({ connection, table, schema }) => {
      const resolved = resolveConnection(connection, mentionedConnectionIds);
      const tableRef = await assertTableExists(resolved.id, table, schema);
      const [columns, references, usedAsReference, restrictions, indexes, triggers, definition, rowsCount] =
        await Promise.all([
          getTableColumns(resolved.id, tableRef),
          getTableReferences(resolved.id, tableRef),
          getTableUsedAsReference(resolved.id, tableRef),
          getTableRestrictions(resolved.id, tableRef),
          getTableIndexes(resolved.id, tableRef),
          getTableTriggers(resolved.id, tableRef),
          getTableDefinition(resolved.id, tableRef),
          getTableRowsCount(resolved.id, tableRef),
        ]);

      return {
        connection: serializeConnectionForAI(resolved),
        table: tableRef,
        rowsCount,
        columns,
        references,
        usedAsReference,
        restrictions,
        indexes,
        triggers,
        definition,
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
        connection: serializeConnectionForAI(resolved),
        function: functionRef,
        definition,
      };
    },
  }),
});

export const AI_TOOL_STOP_CONDITION = isStepCount(6);
