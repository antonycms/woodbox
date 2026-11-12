import type { Knex } from 'knex';

export const executeFilterQuery = async (instance: Knex, connection: object, query: Knex.QueryBuilder | Knex.Raw, explain = false) => {
  const compiled = query.toSQL();
  if (explain) compiled.sql = `EXPLAIN ${compiled.sql}`;
  const sql = compiled.sql;
  const result: unknown = await instance.client.query(connection, compiled);
  if (!result || typeof result !== 'object' || !('response' in result)) throw new Error('Resposta inválida ao executar o filtro.');
  return { raw: result.response, sql };
};
