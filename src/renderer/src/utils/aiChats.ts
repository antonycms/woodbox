export interface IAIChat {
  id: string;
  title: string;
  summary: string;
  updatedAt: string;
  messages: IAIChatMessage[];
}

export interface IAIChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export const AI_CHATS: IAIChat[] = [
  {
    id: 'schema-review',
    title: 'Revisar schema de pedidos',
    summary: 'Notas iniciais para checar tabelas e relações.',
    updatedAt: '2026-08-07T10:20:00.000Z',
    messages: [
      {
        id: 'schema-review-1',
        role: 'user',
        content:
          'Quero revisar o schema de pedidos antes de mexer nos relacionamentos. Comece pelos riscos mais prováveis.',
      },
      {
        id: 'schema-review-2',
        role: 'assistant',
        content:
          'Eu começaria validando FKs entre orders, order_items e customers. Depois verificaria colunas nullable em status, total_amount e timestamps.',
      },
      {
        id: 'schema-review-3',
        role: 'user',
        content: 'Também preciso saber se há chance de pedido ficar sem item.',
      },
      {
        id: 'schema-review-4',
        role: 'assistant',
        content:
          'Boa checagem. A regra ideal é bloquear orders sem order_items antes de confirmar pagamento, ou criar uma validação transacional no fluxo de checkout.',
      },
    ],
  },
  {
    id: 'query-optimization',
    title: 'Otimizar query de vendas',
    summary: 'Rascunho para analisar joins, filtros e índices.',
    updatedAt: '2026-08-06T18:45:00.000Z',
    messages: [
      {
        id: 'query-optimization-1',
        role: 'user',
        content:
          'Essa query de vendas ficou lenta após adicionar filtro por período e vendedor. O que você analisaria primeiro?',
      },
      {
        id: 'query-optimization-2',
        role: 'assistant',
        content:
          'Eu olharia o plano de execução, a seletividade do período e se existem índices em sold_at, seller_id e nas FKs usadas nos joins.',
      },
      {
        id: 'query-optimization-3',
        role: 'assistant',
        content:
          'Se a tabela de vendas cresceu muito, também vale comparar o custo de um índice composto seller_id + sold_at contra filtros separados.',
      },
    ],
  },
  {
    id: 'migration-plan',
    title: 'Planejar migração',
    summary: 'Checklist para validar etapas antes da execução.',
    updatedAt: '2026-08-05T14:10:00.000Z',
    messages: [
      {
        id: 'migration-plan-1',
        role: 'user',
        content:
          'Preciso criar uma coluna obrigatória em produção sem travar escrita. Monte um plano inicial.',
      },
      {
        id: 'migration-plan-2',
        role: 'assistant',
        content:
          'Plano seguro: adicionar coluna nullable, preencher em lotes, validar registros pendentes, ajustar aplicação para escrever a coluna e só depois aplicar NOT NULL.',
      },
      {
        id: 'migration-plan-3',
        role: 'user',
        content: 'Quero deixar claro onde entra rollback.',
      },
      {
        id: 'migration-plan-4',
        role: 'assistant',
        content:
          'Rollback deve existir por fase. Antes do NOT NULL, basta parar escrita nova e ignorar a coluna. Depois do NOT NULL, prepare script para remover constraint se houver falha.',
      },
    ],
  },
];

export const getAIChatById = (id: string) => {
  return AI_CHATS.find((chat) => chat.id === id);
};
