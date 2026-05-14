# Auditoria de performance e rerenders

Este documento reúne os pontos encontrados na inspeção estática do projeto, com foco em desempenho, rerenders, efeitos desnecessários e possíveis gargalos em telas com muitos dados.

Objetivo: servir como backlog incremental para criar planos pequenos e aplicar correções aos poucos.

## Sumário de prioridades

1. Debounce real do parse de SQL/current query.
2. Memoizar `columns` e callbacks em `TabContentSelect`.
3. Evitar renderização pesada de abas ocultas.
4. Refatorar `loadReferenceRow`.
5. Otimizar serialização/clonagem de linhas na `Table`.
6. Estabilizar provider de autocomplete do Monaco.
7. Revisar carregamento de colunas/referências para múltiplas tabelas.

---

## 1. Parsing de SQL roda em excesso durante digitação/cursor

**Arquivos envolvidos:**

- `src/renderer/src/components/Editor/index.tsx`
- `src/renderer/src/views/QueryEditor/index.tsx`

### Problema

O editor chama `props.onChangeCurrentValue` em toda alteração de conteúdo e em toda mudança de cursor:

```tsx
editor?.getModel?.()?.onDidChangeContent(() => {
  const value = getValue();
  const currentValue = getCurrentValue();

  props.onChange?.(value);
  props.onChangeCurrentValue?.(currentValue);
});

editor?.onDidChangeCursorPosition?.(() => {
  props.onChangeCurrentValue?.(getCurrentValue());
});
```

No `QueryEditor`, esse callback faz parse imediatamente:

```tsx
const handleUpdateCurrentQueryInfo = React.useCallback((query: string) => {
  const tablesQueryInfo = getTablesFromQuerySql(query);

  setCurrentQueryTablesInfo((prevState) => {
    const checkIsEquals = arrayIsEquals(prevState, tablesQueryInfo);
    return checkIsEquals ? prevState : tablesQueryInfo;
  });
}, []);
```

Apesar de `setCurrentQueryTablesInfo` usar debounce, o custo pesado de `getTablesFromQuerySql(query)` já aconteceu antes do debounce.

### Impacto

Em scripts grandes, digitar ou mover o cursor pode causar engasgos por parse repetido de SQL.

### Correção recomendada

Aplicar debounce no callback inteiro ou dentro do `Editor`, antes de executar `getCurrentValue`/`getTablesFromQuerySql`.

### Checklist

- [ ] Criar debounce para `handleUpdateCurrentQueryInfo`.
- [ ] Garantir que `getTablesFromQuerySql` não rode a cada movimento de cursor.
- [ ] Validar autocomplete após a mudança.
- [ ] Testar digitação em scripts grandes.

---

## 2. Todas as abas de resultado continuam montadas, inclusive ocultas

**Arquivos envolvidos:**

- `src/renderer/src/views/QueryEditor/index.tsx`
- `src/renderer/src/components/Tabs/components/TabContent/index.tsx`
- `src/renderer/src/components/Tabs/styles.module.css`

### Problema

O `QueryEditor` renderiza todas as abas de resultado:

```tsx
{tabsResult.map((tabResult) => {
  const data = querysResultData.get(tabResult.idTab);

  return (
    <TabContent key={tabResult.idTab} idTab={tabResult.idTab}>
      {data.type === 'SELECT' && (
        <TabContentSelect ... />
      )}
    </TabContent>
  );
})}
```

O conteúdo inativo fica apenas oculto via CSS:

```css
.tabContent {
  display: none;
}

.tabContent.active {
  display: flex;
}
```

Ou seja, abas ocultas continuam montadas, mantendo componentes pesados, estados, effects, listeners, tabelas e observadores.

### Impacto

Com várias abas de resultado ou resultados grandes, trocar aba/atualizar dados pode custar mais do que o necessário.

### Correção recomendada

Escolher uma estratégia:

- renderizar apenas a aba ativa;
- ou memoizar `TabContentSelect` e filhos pesados;
- ou criar política opcional de keep-alive para preservar estado local quando necessário.

### Checklist

- [ ] Decidir se abas inativas devem preservar estado local.
- [ ] Renderizar somente conteúdo da aba ativa, se possível.
- [ ] Medir comportamento de preview/edições ao trocar abas.
- [ ] Garantir que fechar/remover abas continue limpando dados corretamente.

---

## 3. Props instáveis invalidam memoização da tabela

**Arquivo envolvido:**

- `src/renderer/src/views/QueryEditor/components/TabContentSelect/index.tsx`

### Problema

`columns` é recriado em todo render:

```tsx
columns={(data.columns || []).map((column) => ({
  title: 'Clique para ordenar por essa coluna',
  attribute: column,
  label: column,
  sortable: true,
  editable: !!editableTable,
  isLink: tabFkMap.has(column),
}))}
```

Também existem callbacks não memoizados:

```tsx
const onContextMenuTable = (...)
const onCellLinkClick = (...)
```

### Impacto

Mesmo com `React.memo` em partes da tabela, novas referências de arrays/funções podem disparar renders/effects desnecessários.

### Correção recomendada

- Criar `columns` com `React.useMemo`.
- Criar `onContextMenuTable` com `React.useCallback`.
- Criar `onCellLinkClick` com `React.useCallback`.
- Avaliar handlers inline passados pelo `QueryEditor` para `TabContentSelect`.

### Checklist

- [ ] Memoizar `columns`.
- [ ] Memoizar `onContextMenuTable`.
- [ ] Memoizar `onCellLinkClick`.
- [ ] Verificar se `TableDefaultView` reduz renders após a mudança.

---

## 4. `loadReferenceRow` pode causar renders extras e retry indesejado

**Arquivo envolvido:**

- `src/renderer/src/views/QueryEditor/components/TabContentSelect/index.tsx`

### Problema

`loadReferenceRow` limpa o erro antes de validar se precisa carregar algo:

```tsx
const loadReferenceRow = async () => {
  setReferenceError(undefined);

  if (activePreviewTab !== 'reference') return;
  if (!selectedReference || !selectedReferenceCacheKey) return;
  if (referenceCache.has(selectedReferenceCacheKey)) return;
  if (referenceLoadingKeys.has(selectedReferenceCacheKey)) return;
  if (referenceError) return;

  ...
};
```

O effect também depende de `referenceCache`, `referenceLoadingKeys` e `referenceError`:

```tsx
React.useEffect(() => {
  loadReferenceRow();
}, [
  activePreviewTab,
  selectedReference,
  selectedReferenceCacheKey,
  referenceCache,
  referenceLoadingKeys,
  referenceError,
  selectedCell?.value,
  getTableData,
  id_connection,
]);
```

### Impacto

- Renders extras.
- Possível retry desnecessário após erro.
- Reexecução do effect por alterações em `Map`/`Set`.

### Correção recomendada

- Fazer guards antes de qualquer `setState`.
- Limpar erro somente quando a referência/chave selecionada mudar.
- Reduzir dependências do effect, usando refs ou callbacks quando adequado.

### Checklist

- [ ] Mover `setReferenceError(undefined)` para um effect separado baseado em `selectedReferenceCacheKey`.
- [ ] Evitar depender diretamente de `referenceCache`/`referenceLoadingKeys` se isso causar loops.
- [ ] Testar seleção de FK com sucesso.
- [ ] Testar erro de carregamento de FK.

---

## 5. `Table` serializa/clona todas as linhas

**Arquivo envolvido:**

- `src/renderer/src/components/Table/index.tsx`

### Problema

A tabela clona todas as linhas para adicionar metadados:

```tsx
const serializedRows = React.useMemo(() => {
  const serializedRows = rows.map((row, index) => {
    const keyRow = rowKeyExtractor(row, index);

    return {
      ...row,
      __index_row: index + newRowsLength,
      __row_index: index,
      __key_row: keyRow,
    };
  });

  return [...serializedNewRows, ...serializedRows];
}, [rows, newRows]);
```

Mesmo com virtualização visual, o custo de serialização é proporcional ao total de linhas carregadas.

### Impacto

Em resultados grandes ou paginação incremental, há custo extra de CPU e memória.

### Correção recomendada

Evitar clonar todas as linhas. Possíveis abordagens:

- manter metadados separados;
- gerar wrappers apenas para o range visível;
- usar helper para obter `__key_row`, `__index_row` e `__row_index` sem mutar/clonar o objeto original.

### Checklist

- [ ] Mapear todos os locais que dependem de `__key_row`, `__index_row`, `__row_index`.
- [ ] Criar alternativa sem clonagem completa.
- [ ] Garantir seleção, edição, copy e analysis mode.
- [ ] Testar com paginação grande.

---

## 6. Autocomplete pode ser registrado/desregistrado com frequência

**Arquivos envolvidos:**

- `src/renderer/src/components/Editor/index.tsx`
- `src/renderer/src/views/QueryEditor/index.tsx`

### Problema

O provider de autocomplete é recriado sempre que `props.autocomplete` muda:

```tsx
React.useEffect(() => {
  if (!editor) return;

  const disposable = defineSQlAutocomplete(props.autocomplete);

  return () => disposable?.dispose();
}, [editor, props.autocomplete]);
```

No `QueryEditor`, `autocomplete` muda conforme `currentQueryTablesInfo` e `tableColumns`.

### Impacto

Durante digitação/movimentação de cursor em queries com tabelas diferentes, o provider do Monaco pode ser recriado mais vezes que o necessário.

### Correção recomendada

- Registrar o provider uma vez.
- Manter os dados atuais em uma ref.
- Fazer o provider ler da ref no momento da sugestão.

### Checklist

- [ ] Verificar implementação de `defineSQlAutocomplete`.
- [ ] Adaptar para aceitar getter/ref, se necessário.
- [ ] Registrar provider uma única vez por editor.
- [ ] Testar atualização de tabelas/colunas no autocomplete.

---

## 7. Carregamento de colunas/referências só busca uma tabela por effect

**Arquivo envolvido:**

- `src/renderer/src/views/QueryEditor/index.tsx`

### Problema

`loadTableColumns` e `loadTableReferences` procuram apenas a primeira tabela ainda não carregada.

Os effects são:

```tsx
React.useEffect(() => {
  loadTableColumns();
}, [id_connection, currentQueryTablesInfo]);

React.useEffect(() => {
  loadTableReferences();
}, [id_connection, currentQueryTablesInfo]);
```

Como os effects não dependem de `tableColumns`/`tableReferences`, quando uma tabela é carregada não há garantia de continuar carregando as próximas.

### Impacto

Queries com múltiplas tabelas podem carregar colunas/referências apenas da primeira tabela pendente.

### Correção recomendada

- Carregar todas as tabelas pendentes em batch.
- Ou criar uma fila/loop controlado para continuar após cada atualização.

### Checklist

- [ ] Identificar comportamento esperado para múltiplas tabelas.
- [ ] Trocar busca unitária por batch de pendentes.
- [ ] Evitar chamadas duplicadas para mesma tabela.
- [ ] Testar autocomplete e links FK em queries com múltiplas tabelas.

---

## Backlog sugerido de planos pequenos

### Plano A — reduzir custo ao digitar no editor

Itens:

- item 1;
- parte do item 6, se necessário.

Resultado esperado:

- digitação e movimentação de cursor mais fluídas em SQL grande.

### Plano B — estabilizar props da tabela de resultados

Itens:

- item 3.

Resultado esperado:

- menos rerenders em `Table`/`TableDefaultView`.

### Plano C — corrigir preview de referência

Itens:

- item 4.

Resultado esperado:

- menos renders e comportamento mais previsível em FK preview.

### Plano D — otimizar abas de resultado

Itens:

- item 2.

Resultado esperado:

- menos custo com abas ocultas.

### Plano E — otimização estrutural da tabela

Itens:

- item 5.

Resultado esperado:

- melhor escalabilidade com muitos registros.

### Plano F — melhorar carregamento de metadados SQL

Itens:

- item 7.

Resultado esperado:

- autocomplete/referências funcionam melhor com múltiplas tabelas.

