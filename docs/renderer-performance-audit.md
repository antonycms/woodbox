# Auditoria do renderer: performance e qualidade

Data: 2026-07-27  
Escopo: `src/renderer/src` inteiro.  
Resultado: relatório técnico para guiar refatorações futuras. Nenhum código de runtime foi alterado.

## Resumo executivo

O renderer tem bons esforços de virtualização, memoização e separação por contexto, mas há gargalos claros:

1. **Contexts muito amplos e sem `value` memoizado**: mudanças pequenas em `Store`, `AppTab` e `TableInfoContext` tendem a propagar renderizações para muitos consumidores.
2. **`Table` virou componente “god object”**: 1400 linhas, muitos estados, refs, handlers e efeitos. É o principal ponto de risco para renderizações e manutenção.
3. **Virtualização parcial**: `VirtualizeList` e `Table` reduzem DOM visível, mas ainda fazem varreduras O(n) por render/scroll em alguns caminhos.
4. **Funções/objetos inline anulam parte do `React.memo`**: especialmente em `TableDefaultView`, `TabContentSelect`, `Data`, `MainContent`, `ProjectsMenu`.
5. **Efeitos com dependências incompletas ou intencionais não documentadas**: podem causar estado obsoleto e dificultam manutenção.
6. **Duplicação alta**: Autocomplete, abas de propriedades e fluxos de edição/DDL repetem padrões quase iguais.

> Nota: `useMemo` não dispara renderização sozinho. Ele executa durante render e guarda resultado entre renders. O uso excessivo pode aumentar custo cognitivo e custo de comparação/dependências, mas a causa de render extra costuma ser `setState`, context value novo, props instáveis ou estado derivado.

## Métricas rápidas

- Arquivos TS/TSX analisados: **170**
- Linhas TS/TSX: **~31.306**
- Ocorrências: `useMemo` **162**, `useCallback` **261**, `useEffect` **124**, `React.memo` **32**
- Maiores arquivos:
  - `components/Table/index.tsx` — 1401 linhas
  - `views/QueryEditor/components/TabContentSelect/index.tsx` — 1222 linhas
  - `views/TableInfo/components/Data/index.tsx` — 1189 linhas
  - `views/QueryEditor/index.tsx` — 1152 linhas
  - `components/Sidebar/components/menus/ProjectsMenu/index.tsx` — 880 linhas

## Status das melhorias aplicadas

Legenda:

- ✅ corrigido neste ciclo
- 🟡 parcialmente corrigido neste ciclo
- ⏳ pendente

- 🟡 **1. `Store`**: actions/loaders e `value` memoizados; agrupamento de conexões otimizado. Ainda falta separar contexts ou migrar para Zustand.
- 🟡 **2. `AppTab`**: `value` memoizado e `getTab` passou a usar `Map`. Ainda falta separar state/actions ou migrar para Zustand.
- 🟡 **3. `Table`**: constantes movidas para `constants.ts`, deps corrigidas, `rowsDetails` e `cssVars` memoizados. `useTableLayout` e `useTableColumnResize` extraídos para derivar layout e handlers de resize. Extrações maiores seguem pendentes.
- 🟡 **4. Células da `Table`**: `TableDefaultView`/`TableColumn` tiveram dados memoizados, cabeçalho extraído, número da linha isolado e callbacks internos/edição da célula estabilizados. `TableAnalysisView` isolou células de leitura em componente memoizado e estabilizou handlers/link style de leitura/edição. Delegação de eventos e comparadores customizados nas células seguem pendentes.
- ✅ **5. `VirtualizeList`**: caminho O(1) para `itemSize` fixo e debounce sem `setTimeout(0)` via `useStateWithDebounce`.
- 🟡 **6. `ProjectsMenu`**: árvore memoizada, scripts agrupados/reutilizados por conexão, lookups de loading por `Set`, índice plano para revelar itens ativos, itens renderizados memoizados e handlers do TreeView/botões estabilizados. Virtualização de nós segue pendente.
- ✅ **7. `TreeView`**: lookup por `Map`, navegação limitada ao container, tema centralizado no pai, itens abertos por `Set`, lista plana memoizada de nós visíveis e `ItemTreeView` memoizado.
- 🟡 **8. `QueryEditor`**: deps do autocomplete corrigidas, loads de colunas/referências usando refs/callbacks, `useQueryCancellation` extraído, helpers puros de resultado/captura movidos para `utils/queryResult.ts` e callbacks/dados calculados de tabs/modais estabilizados. Hooks maiores de execução SQL seguem pendentes.
- ✅ **9. `TabContentSelect`**: colunas, handlers e menu de contexto estabilizados.
- 🟡 **10. `TableInfo/Data`**: `rowKeyExtractor`, context menu e handlers estabilizados. Unificação com `TabContentSelect` segue pendente.
- ✅ **11. `CentralSearchModal`**: cálculos pesados evitados quando fechada, `connectionsById` memoizado, loops/offsets otimizados.
- ✅ **12. `Editor` autocomplete**: provider SQL global único por model e `console.log` removido.
- 🟡 **13. Autocomplete**: listeners globais só ficam ativos com dropdown aberto e outside-click foi extraído para `useDropdownOutsideClick`. Core completo compartilhado segue pendente.
- 🟡 **14. Abas de propriedades**: `useFilteredSortedRows`, `useSelectionReconciliation` e `usePropertiesKeyboardShortcuts` extraídos; handlers de menu de contexto estabilizados nas tabs principais; `columns`/`onSort` estabilizados em `Columns`, `Indexes`, `Restrictions`, `ForeingKeys`, `References` e `Triggers`. Componente compartilhado de painel/barra segue pendente.
- ✅ **15. `useResize`/debounce**: stale closure corrigida, cleanup de timeout e `useStateWithDebounce` sem debounce quando `delay` é indefinido.
- 🟡 **16. `useMemo` trivial**: constantes principais da `Table` removidas do componente. Revisão geral segue pendente.
- ✅ **17. Efeitos mount-only**: efeitos exemplares de carga/inicialização documentados e dependência simples do `Diagram` corrigida.

## Prioridade alta

### 1. Context `Store` renderiza consumidores demais

**Local**: `src/renderer/src/contexts/Store/index.tsx`

**Problema**

O provider monta `value={{ ... }}` inline e várias funções são recriadas a cada render. Qualquer mudança em `projects`, `connections`, `connectionsInfo`, `scripts` etc. troca a identidade do value inteiro e re-renderiza todo consumidor de `useStoreContext()`.

**Impacto**

Alto. `QueryEditor`, `ProjectsMenu`, `CentralSearchModal`, `TableInfoContext`, `Data` e propriedades consomem esse contexto. Uma atualização de scripts/conexões pode re-renderizar telas pesadas.

**Soluções possíveis**

- Memorizar o `value` com `React.useMemo`.
- Estabilizar ações com `React.useCallback`.
- Separar contexts por domínio:
  - `ProjectsContext`
  - `ConnectionsContext`
  - `ConnectionInfoContext`
  - `ScriptsContext`
  - `DatabaseActionsContext`
- Para ações IPC estáveis, considerar `useLatestFunc` ou callbacks com atualização funcional.

---

### 2. Context `AppTab` propaga renderizações globais

**Local**: `src/renderer/src/contexts/AppTab/index.tsx`

**Problema**

O provider também monta `value` inline. `getTab` não usa `useCallback`. Muitas ações dependem de `tabs`, `tabGroups` e `activeTabId`, então mudam identidade com frequência.

**Impacto**

Alto. `Sidebar`, `MainContent`, `CentralSearchModal`, `TabContentSelect` e abertura de abas dependem dele. Troca de aba pode invalidar mais componentes que o necessário.

**Soluções possíveis**

- Memoizar `value`.
- Criar `tabsById` via `useMemo` para `getTab` O(1).
- Separar leitura de estado e ações:
  - `AppTabStateContext`
  - `AppTabActionsContext`
- Em componentes que só chamam ações, consumir só actions para evitar render por mudança de `tabs`.

---

### 3. `Table` centraliza lógica demais

**Local**: `src/renderer/src/components/Table/index.tsx`

**Problema**

O componente concentra virtualização, seleção, edição, colagem, análise, scroll, atalhos, context menu, estilos e serialização. Há muitos refs para contornar closures e vários efeitos de teclado/scroll.

Pontos específicos:

- Constantes como `rowHeight`, `maxColumnSize`, `defaultColumnSize`, `rowNumberColumnWidth` usam `useMemo(() => valor, [])` sem ganho.
- `serializedRows` depende de `rowKeyExtractor`, mas ele não está no array de dependências.
- `rowsDetails` é calculado em IIFE a cada render; barato, mas mistura derivação visual no corpo.
- `cssVars` é objeto novo a cada render.
- Seleção usa `Set<string>`; cada alteração recria `Set` e re-renderiza o grid visível inteiro.
- Eventos `keydown` são registrados em efeitos separados e fazem muito trabalho imperativo.

**Impacto**

Muito alto. É usado para dados de tabela, resultados SQL e abas de propriedades. Pequenas mudanças de estado podem renderizar muitas células.

**Soluções possíveis**

- Extrair hooks:
  - `useTableVirtualization`
  - `useTableSelection`
  - `useTableEditing`
  - `useTableKeyboardNavigation`
  - `useTableContextMenuData`
  - `useAnalysisMode`
- Trocar constantes simples por constantes fora do componente.
- Incluir `rowKeyExtractor` em deps ou estabilizar o extrator no pai.
- Avaliar reducer para seleção/edição.
- Isolar estado de seleção em store externa pequena ou refs + assinatura mínima, reduzindo render total.
- Medir com React Profiler antes/depois.

---

### 4. `React.memo` é pouco efetivo em células da tabela

**Locais**

- `src/renderer/src/components/Table/components/TableDefaultView/index.tsx`
- `src/renderer/src/components/Table/components/TableColumn/index.tsx`
- `src/renderer/src/components/Table/components/TableRow/index.tsx`

**Problema**

`TableColumn` e `TableRow` usam `React.memo`. O cabeçalho foi extraído para `TableHeaderColumn`, o número da linha para `TableRowNumber` e callbacks internos/edição da célula foram estabilizados, mas ainda há props derivadas por célula que variam conforme seleção/edição.

- callbacks e props derivadas por célula ainda variam conforme seleção/edição

Isso troca identidade a cada render e faz o memo perder efeito.

**Impacto**

Alto em tabelas grandes, seleção por célula e scroll.

**Soluções possíveis**

- Delegar eventos no container usando `data-row-index`/`data-col-index`.
- Criar componente especializado para célula com comparador customizado.
- Evitar style inline repetido; usar CSS vars no nível da linha/grid quando possível.
- Passar handlers estáveis e dados primitivos.

---

### 5. `VirtualizeList` ainda percorre todos os itens

**Local**: `src/renderer/src/components/VirtualizeList/index.tsx`

**Problema**

A lista virtualizada calcula `totalHeight`, `indexStart` e `indexEnd` iterando de `0` até `itemCount` a cada render. Para `itemSize` fixo, isso poderia ser O(1). Para muitos itens, scroll ainda custa O(n).

Também usa `useStateWithDebounce(0)` sem delay explícito, o que agenda `setTimeout` em vez de atualizar direto.

**Impacto**

Médio/alto. Afeta autocomplete e busca central. Pode piorar com milhares de tabelas/colunas.

**Soluções possíveis**

- Caminho rápido para `itemSize` numérico:
  - `start = Math.floor(scrollTop / itemSize)`
  - `end = Math.ceil((scrollTop + viewport) / itemSize)`
  - `totalHeight = itemCount * itemSize + sticky`
- Para tamanho variável, cache de offsets/prefix sums.
- Trocar debounce por `requestAnimationFrame` no scroll.
- Chamar `onEndReached` com tolerância e proteção contra repetição.

---

## Prioridade média

### 6. `ProjectsMenu` reconstrói árvore inteira em todo render

**Local**: `src/renderer/src/components/Sidebar/components/menus/ProjectsMenu/index.tsx`

**Problema**

`projectsSerialized` é calculado diretamente no corpo do componente. Ele percorre projetos, conexões, tabelas, schemas, funções e scripts. Também filtra e monta objetos novos para `TreeView` em toda renderização.

`contextOptions` tem deps instáveis (`checkHasConnection`, `refreshConnectionInfo`) porque essas funções não usam `useCallback`.

**Impacto**

Alto em conexões com muitas tabelas/funções. A sidebar pode ficar pesada ao digitar filtro, trocar aba ou mudar loading.

**Soluções possíveis**

- Colocar `projectsSerialized` em `useMemo` com deps explícitas.
- Criar índices auxiliares:
  - `scriptsByConnectionId`
  - `connectionInfoById` já é Map, reutilizar
- Extrair serialização para `utils.ts` com testes.
- Memorizar handlers usados por `TreeView`.
- Se árvore crescer muito, adicionar virtualização por nós visíveis.

---

### 7. `TreeView` faz busca recursiva a cada interação

**Locais**

- `src/renderer/src/components/TreeView/index.tsx`
- `src/renderer/src/components/TreeView/ItemTreeView/index.tsx`

**Problema**

O lookup por id já usa `Map`, a navegação por teclado usa lista plana memoizada de nós visíveis, o tema é calculado no pai e `ItemTreeView` foi memoizado. Se a árvore crescer muito, ainda vale virtualizar nós renderizados.

**Impacto**

Médio/alto em árvores grandes.

**Soluções possíveis**

- Se necessário, virtualizar a lista de nós visíveis.

---

### 8. `QueryEditor` está grande e com fluxos duplicados

**Local**: `src/renderer/src/views/QueryEditor/index.tsx`

**Problema**

O arquivo mistura editor, execução SQL, abas de resultado, paginação, captura, autocomplete, atalhos, variáveis e confirmação de produção.

Há funções grandes e semelhantes:

- `executeQuery`
- `refreshResultSqlTab`
- `onScrollEnd`
- `handleSortQueryResult`

Todas repetem criação de `queryExecutionId`, loading, `runSql`, cancelamento e tratamento de erro.

**Impacto**

Médio/alto. Dificulta correções e aumenta risco de inconsistência.

**Soluções possíveis**

- Extrair hook `useQueryExecution`.
- Extrair hook `useQueryResultTabs`.
- Criar helper único `runQueryAndUpdateTab`.
- Usar reducer para `tabsResult` + `querysResultData`.
- Corrigir deps de `autocomplete`: inclui `id_connection` no cálculo, mas ele não está listado explicitamente.

---

### 9. `TabContentSelect` recria colunas e menus em render

**Local**: `src/renderer/src/views/QueryEditor/components/TabContentSelect/index.tsx`

**Problema**

O prop `columns` passado para `Table` é criado inline com `(data.columns || []).map(...)`. `onContextMenuTable` não usa `useCallback`. Context menu principal é array inline. Há lógica duplicada com `TableInfo/components/Data` para preview, edição, DDL e seleção.

**Impacto**

Médio/alto. Afeta resultados de query, que podem ter muitos dados e atualizações frequentes.

**Soluções possíveis**

- Memoizar `tableColumns` com `useMemo`.
- Memoizar `contextMenuOptions`.
- Extrair hook compartilhado para preview de célula:
  - valor selecionado
  - `previewValue`
  - referência selecionada
  - aplicação de valor
- Extrair hook de edição de linhas.

---

### 10. `TableInfo/Data` repete fluxo do resultado SELECT

**Local**: `src/renderer/src/views/TableInfo/components/Data/index.tsx`

**Problema**

Tem lógica muito parecida com `TabContentSelect`: preview, edição, linhas novas, removidas, DDL, menu de contexto e atalhos. O arquivo também passa `rowKeyExtractor` inline para `Table`, gerando função nova.

`loadData` é chamado em `useEffect(() => { loadData(); }, [])`, ignorando deps. Pode ser intencional para carregar só no mount, mas não está documentado.

**Impacto**

Médio/alto. Duplica bugs e dificulta otimização da tabela.

**Soluções possíveis**

- Criar `useEditableRows` compartilhado.
- Criar `useCellPreview` compartilhado.
- Criar `useTableDataPagination` para `page`, `lastPageSearch`, `loading`, `refresh`.
- Estabilizar `rowKeyExtractor` com `useCallback`.
- Documentar efeitos mount-only ou reestruturar para deps corretas.

---

### 11. `CentralSearchModal` calcula dados mesmo fechada

**Local**: `src/renderer/src/components/CentralSearchModal/index.tsx`

**Problema**

A modal fica montada sempre. Mesmo fechada, `useMemo`s podem recalcular itens abertos/fechados quando contextos mudam. `getConnectionDescription` cria `new Map(...)` a cada chamada, dentro de loops.

**Impacto**

Médio. Pode ser pesado com muitas conexões/tabelas/funções.

**Soluções possíveis**

- Criar `connectionsById` uma vez com `useMemo`.
- Só montar/calcultar listas pesadas quando `isOpen` for true.
- Separar componente interno `<CentralSearchContent />` renderizado apenas quando aberto.
- Cachear `closedItemsByType` por versão de `connectionsInfo/scripts/tabs`.

---

### 12. `Editor` registra autocomplete por instância

**Locais**

- `src/renderer/src/components/Editor/index.tsx`
- `src/renderer/src/components/Editor/autocompleteDefault.ts`

**Problema**

Cada editor SQL chama `defineSQlAutocomplete(props.autocomplete)`, que registra um `CompletionItemProvider` global para a linguagem `sql`. Com várias abas congeladas/montadas, pode haver múltiplos providers ativos. O provider usa closures com dados daquela instância.

Há também `console.log` no `contextMenuService.showContextMenu`.

**Impacto**

Médio. Pode duplicar sugestões e aumentar custo do autocomplete conforme abas abertas.

**Soluções possíveis**

- Registrar provider global uma vez.
- Armazenar autocomplete ativo por editor/model em registry/ref.
- Remover `console.log` de produção.
- Atualizar opções do editor via efeitos focados, mantendo listeners estáveis.

---

## Prioridade baixa / limpeza planejada

### 13. Autocomplete tem quatro implementações muito parecidas

**Locais**

- `components/Autocomplete`
- `components/AutocompleteBlank`
- `components/AutocompleteMulti`
- `components/AutocompleteMultiBlank`

**Problema**

Os quatro ainda repetem filtro, navegação por teclado, dropdown, virtualização e seleção. O listener de clique fora foi extraído para `useDropdownOutsideClick` e só fica ativo enquanto o dropdown está aberto.

**Impacto**

Médio em telas com muitos inputs/autocompletes; alto custo de manutenção.

**Soluções possíveis**

- Criar hook `useAutocompleteCore`.
- Usar `ref` do container em vez de `document.getElementById`.
- Compartilhar filtro ordenado e navegação.

---

### 14. Abas de propriedades repetem padrões

**Locais**

- `views/TableInfo/components/Properties/tabs/Columns/index.tsx`
- `.../Indexes/index.tsx`
- `.../Restrictions/index.tsx`
- `.../ForeingKeys/index.tsx`
- `.../References/index.tsx`
- `.../Triggers/index.tsx`

**Problema**

As tabs ainda repetem parte da estrutura visual e atalhos, mas a repetição de filtro/sort e reconciliação de seleção foi reduzida.

Já corrigido neste ciclo:

- filtro por texto separado por vírgula centralizado em `useFilteredSortedRows`
- chamada de `sortRows` centralizada em `useFilteredSortedRows`
- reconciliação de seleção centralizada em `useSelectionReconciliation`
- atalhos Delete/Escape/Ctrl+S centralizados em `usePropertiesKeyboardShortcuts`
- handlers `onContextMenuTable` estabilizados com `useCallback`

Ainda repetido:

- menu de contexto
- barra inferior com refresh/save/cancel

**Impacto**

Médio. Não é o maior gargalo de runtime, mas aumenta risco de bugs e inconsistência.

**Soluções possíveis**

- Reutilizar `useFilteredSortedRows` nas novas tabs de propriedades.
- Reutilizar `useSelectionReconciliation` em tabs com seleção.
- Reutilizar `usePropertiesKeyboardShortcuts` em tabs editáveis.
- Criar componente local `PropertiesTablePanel`.

---

### 15. `useResize` e debounce precisam revisão

**Locais**

- `src/renderer/src/hooks/useResize.tsx`
- `src/renderer/src/hooks/useDebounce.tsx`
- `src/renderer/src/hooks/useStateWithDebounce.tsx`

**Problema**

`useResize` fecha sobre `elementWidth` e `elementHeight`, mas eles não estão nas deps do efeito. O hook também ignora mudanças de `ignoreZeroValue`. `useDebounce` não limpa timeout no unmount. `useStateWithDebounce` usa debounce até quando `delay` é `undefined`.

**Impacto**

Médio. Pode causar updates atrasados, stale closures e setState após unmount em componentes com resize/scroll/autocomplete.

**Soluções possíveis**

- Guardar último tamanho em ref dentro de `useResize`.
- Limpar timeout em `useDebounce` no unmount.
- Se `delay` for `undefined`, executar direto ou usar delay padrão explícito.
- Considerar `requestAnimationFrame` para scroll/resize.

---

### 16. Uso de `useMemo` para valores triviais

**Locais exemplares**

- `components/Table/index.tsx`: `rowHeight`, `maxColumnSize`, `defaultColumnSize`, `rowNumberColumnWidth`
- `components/Table/index.tsx`: `columnsSignature` para reset de análise
- `components/SettingsGeneralPanel/index.tsx`: `languageOptions = [...availableLanguages]`
- `components/Spacer`, `Divider`, `Button`, `Input`: estilos simples em `useMemo`

**Problema**

Nem todo `useMemo` é ruim, mas alguns só escondem constantes ou objetos simples. Isso aumenta ruído e dependências sem ganho mensurável.

**Impacto**

Baixo isoladamente; médio no conjunto por legibilidade.

**Soluções possíveis**

- Manter `useMemo` só em cálculos caros, arrays/objetos passados para componentes memoizados ou context values.
- Mover constantes para fora do componente.
- Preferir CSS classes/vars para estilos estáticos.

---

### 17. Efeitos mount-only sem documentação

**Locais exemplares**

- `TableInfo/components/Data/index.tsx`: `loadData()` em deps vazias
- `Properties/tabs/*/index.tsx`: loads em deps vazias
- `QueryEditor/index.tsx`: load de script e listeners
- `Editor/index.tsx`: inicialização do Monaco em deps vazias

**Problema**

Os efeitos exemplares de carga/inicialização com deps vazias foram documentados quando o comportamento é intencional por ciclo de vida de aba/editor. Um futuro agente ainda deve evitar novos efeitos mount-only sem comentário ou sem deps corretas.

**Impacto**

Médio para manutenção.

**Soluções possíveis**

- Manter comentário curto quando for intencional: “monta uma vez porque a aba é recriada por tabela”.
- Preferir remount via `key` quando props mudarem.
- Onde não for intencional, corrigir deps e estabilizar callbacks.

---

## Backlog sugerido por ordem

1. **Medir antes**: habilitar React Profiler ou `useTraceUpdate` em `Table`, `Data`, `TabContentSelect`, `ProjectsMenu`, `CentralSearchModal`.
2. **Estado global**: migrar contexts principais para Zustand, começando por `AppTab` e `Store`.
3. **Table**: extrair hooks e estabilizar props/handlers das células.
4. **VirtualizeList**: otimizar caminho de `itemSize` fixo.
5. **ProjectsMenu + TreeView**: memoizar árvore e criar índice por id.
6. **QueryEditor**: extrair execução SQL e estado de resultados.
7. **Unificar Data/TabContentSelect**: hooks compartilhados de edição/preview.
8. **Autocomplete**: criar core compartilhado e listeners sob demanda.
9. **Properties tabs**: extrair componente compartilhado de painel/barra.
10. **Revisar novos efeitos mount-only** durante refatorações futuras.

## Decisão arquitetural recomendada: migrar contexts para Zustand

O objetivo futuro é substituir o uso de contexts de estado global por Zustand. A mudança tende a deixar o fluxo mais previsível e reduzir renderizações em cascata, principalmente porque Zustand permite selectors finos:

```ts
const tabs = useAppTabStore((state) => state.tabs);
const addTab = useAppTabStore((state) => state.addTab);
```

Com isso, um componente que só usa `addTab` não precisa re-renderizar quando `tabs` muda.

### Contexts prioritários para migração

1. `src/renderer/src/contexts/AppTab`
   - Melhor primeiro alvo.
   - Estado muda frequentemente: `tabs`, `tabGroups`, `activeTabId`.
   - Afeta `Sidebar`, `MainContent`, `CentralSearchModal` e fluxos de abertura de abas.

2. `src/renderer/src/contexts/Store`
   - Segundo alvo.
   - Separar em slices:
     - `projects`
     - `connections`
     - `connectionsInfo`
     - `scripts`
     - actions IPC
   - Evita re-render em consumidores que usam só ações ou só parte do estado.

3. `src/renderer/src/contexts/TableInfoContext`
   - Migrar depois de `AppTab` e `Store`.
   - Exige cuidado para isolar estado por tabela/aba e evitar vazamento entre abas.
   - Bom candidato para store factory por `appTabId`/chave da tabela.

### Contexts que podem ficar por último

- `ThemeContext`: muda pouco; ganho menor.
- `I18nContext`: muda pouco; context atual é aceitável.
- `ToastContext`: simples; pode virar store depois, mas não é gargalo principal.

### Recomendações para a migração

- Não criar uma store gigante.
- Usar slices com responsabilidades claras.
- Usar selectors em todo consumo.
- Persistir só dados serializáveis, não componentes React.
- Em `AppTab`, armazenar `data` da aba e resolver o componente em camada separada.
- Medir renderizações antes/depois com React Profiler.
- Migrar em PRs pequenos:
  1. `AppTab`
  2. `Store`
  3. `TableInfoContext`
  4. `Toast`, `Theme`, `I18n` se ainda fizer sentido.

## Critérios de validação futura

- Abrir conexão com muitas tabelas e medir:
  - tempo para expandir conexão
  - digitação no filtro da sidebar
  - Ctrl+K com muitas tabelas
- Executar query com muitas linhas/colunas e medir:
  - scroll vertical/horizontal
  - seleção por arraste
  - edição de célula
  - preview lateral aberto
- Comparar renderizações com React Profiler antes/depois.
- Rodar validação web após mudanças:

```bash
rtk npm run typecheck:web
```

## Observações finais

As melhorias de maior retorno não são remover todos os `useMemo`. O foco deve ser reduzir **propagação de render via context**, **props instáveis em listas/tabelas**, **varreduras O(n) em scroll/busca**, e **duplicação que impede otimizar uma vez só**.
