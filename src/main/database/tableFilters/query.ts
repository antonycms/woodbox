import type { Knex } from 'knex';

export const executeFilterQuery = async (instance: Knex, connection: object, query: Knex.QueryBuilder | Knex.Raw) => {
  const compiled = query.toSQL();
  const result: unknown = await instance.client.query(connection, compiled);
  if (!result || typeof result !== 'object' || !('response' in result)) throw new Error('Resposta inválida ao executar o filtro.');
  return { raw: result.response };
};
