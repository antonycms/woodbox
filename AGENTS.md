@/home/antony/.codex/RTK.md

# Woodbox — regras para agentes

## Escopo

- Aplicação desktop Electron + React para gerenciamento de bancos de dados.
- Stack principal: Electron 35, electron-vite, React 19, TypeScript, CSS Modules, Monaco Editor, Knex, PostgreSQL, MySQL e SQLite.
- `src/main`: processo principal do Electron, IPC, conexões, queries e storage local.
- `src/preload`: ponte segura entre Electron e renderer.
- `src/renderer`: interface React.
- Interface e mensagens de produto devem usar português brasileiro, salvo textos técnicos de SQL/banco.

## Regras globais

- Faça mudanças pequenas e focadas no pedido.
- Não aplique lint/format geral, apenas no que for modificado.
- Não altere linhas, imports, estilos ou arquivos fora do necessário.
- Reutilize padrões existentes antes de criar abstrações novas.
- Evite `any` quando houver tipo viável, mesmo com `strict: false` no projeto.
- Use aliases existentes:
  - `@renderer/*` dentro do renderer.
  - imports relativos no `src/main` e `src/preload`, seguindo o padrão atual.
- Em comandos shell, siga o RTK: prefixe com `rtk`.
- Não introduza Tailwind, styled-components ou nova lib visual sem pedido explícito.

## Comandos úteis

Na raiz:

```bash
rtk npm run dev
rtk npm run typecheck
rtk npm run build
```

Typecheck separado:

```bash
rtk npm run typecheck:node
rtk npm run typecheck:web
```

Atenção: `npm run lint` executa ESLint com `--fix`. Só rode se for pedido ou combinado.

## Estrutura do projeto

```txt
src/
├── main/               # Processo principal Electron
│   ├── database/       # Conexões, dialetos, queries e execução SQL
│   ├── files/          # Operações de arquivos
│   ├── storage/        # Persistência local via electron-store
│   └── utils/          # Helpers de IPC/eventos
├── preload/            # API exposta ao renderer
└── renderer/           # React frontend
    └── src/
        ├── components/ # Componentes reutilizáveis
        ├── contexts/   # Estado global
        ├── database/   # Tipos/helpers de banco usados no renderer
        ├── hooks/      # Hooks reutilizáveis
        ├── styles/     # Reset, tema e ícones
        ├── utils/      # Utilidades do renderer
        └── views/      # Telas principais
```

## Renderer (`src/renderer`)

### Base técnica

- Use React com componentes funcionais.
- Use `@renderer/...` para imports do renderer.
- Prefira reutilizar componentes, hooks, contexts e utils existentes antes de criar novos.
- Não crie estado manual extenso quando já houver hook ou context no projeto que resolva o caso.
- Ícones devem seguir `unplugin-icons` com imports `~icons/{collection}/{name}`; quando fizer sentido, centralize em `src/renderer/src/styles/icons.tsx`.

### Estrutura e componentes

- Componentes reutilizáveis ficam em `src/renderer/src/components/<Nome>/index.tsx`.
- Estilos locais ficam em `styles.module.css` ao lado do componente.
- Views/telas principais ficam em `src/renderer/src/views/<NomeDaView>/index.tsx`.
- Hooks reutilizáveis ficam em `src/renderer/src/hooks`.
- Utils reutilizáveis ficam em `src/renderer/src/utils`.
- Quando uma view tiver componentes usados apenas nela, isole em `components/` dentro da pasta da própria view.
- Só mova para `src/renderer/src/components` quando o componente for realmente reutilizado por mais de uma view/fluxo.
- Ao criar view ou componente novo, crie uma pasta com o nome da view/componente e coloque os arquivos dentro dela.
- Estrutura padrão: `index.tsx`; quando necessário, adicionar `constants.ts`, `dtos.ts`, `types.ts`, `utils.ts`, `styles.module.css`, `hooks/` e `components/`.
- Mantenha no `index.tsx` da view apenas a orquestração principal: carregamento essencial, estados de abertura e composição da tela.
- Evite acumular componentes grandes, cards, modais, menus e helpers específicos no `index.tsx`.
- Lógicas exclusivas de modal/dropdown/painel devem ficar dentro do próprio componente.
- Chamadas de storage/IPC/API usadas só por um modal/dropdown/painel devem ficar nesse componente, não na view pai.
- A view pai deve passar apenas dados mínimos de contexto para filhos, como `active`, `onClose`, ids e registro selecionado.
- Evite duplicar tipos, constantes, mapeamentos e formatadores; extraia para arquivo local quando for específico da view ou para `utils`/`hooks` quando for reutilizável.

### UI e estilo

- Preserve a identidade atual: interface escura, focada, técnica, com destaque neon/suave para ações e estados.
- Textos não interativos devem desabilitar seleção: use `userSelect={false}` no componente `Text`; se não usar `Text`, aplique via CSS.
- Antes de criar novas cores, consulte `src/renderer/src/styles/theme/default.ts`.
- Prefira tokens do tema atual (`__colors`) e variáveis CSS geradas pelo `ThemeProvider`.
- Não hardcode cores repetidas quando já houver valor equivalente no tema.
- Mantenha CSS Modules local ao componente.
- Evite mudanças visuais amplas em componentes compartilhados sem necessidade.

### Estado, eventos e feedback

- Reutilize contexts existentes: `Store`, `Theme`, `Toast`, `AppTab` e outros antes de criar estado global novo.
- Todo texto visível ao usuário no renderer deve usar `useI18n` com chaves em `src/renderer/src/contexts/I18n`; não deixe labels, placeholders, tooltips, títulos de modal ou toasts hardcoded.
- Use hooks existentes como `useForm`, `useStorage`, `useDebounce`, `useResize` e `useLatestFunc` quando aplicável.
- Para mensagens ao usuário, use o padrão de Toast existente.
- Mensagens de erro e confirmação devem ser claras e em português brasileiro.

### Ordem dos Hooks

Sempre que possível, organize hooks dentro do componente nesta ordem:

1. Contextos e estado global.
2. Estado local.
3. Referências.
4. Hooks personalizados.
5. `useMemo` e `useCallback`.
6. `useEffect` e `useLayoutEffect`.

`useMemo`, `useCallback` e efeitos devem ficar agrupados logo antes do `return`, sem ficarem espalhados entre handlers.

## Main process (`src/main`)

- Registre handlers IPC com `addListener`.
- Handlers devem retornar pelo wrapper atual `{ data, error }`; não duplique try/catch quando `addListener` já cobre o caso.
- Regras de conexão e execução SQL devem ficar em `src/main/database`.
- Persistência local deve ficar em `src/main/storage`.
- Operações de arquivos devem ficar em `src/main/files`.
- Não exponha credenciais no renderer além do que já estiver salvo/necessário para a UI.
- Ao abrir conexões, garanta destruição/fechamento quando aplicável para evitar vazamentos.
- Preserve `closeAllConnections` no encerramento da aplicação.

## Banco de dados

- Use Knex e os adaptadores existentes em `src/main/database/dialects`.
- Ao adicionar suporte a dialeto ou query de metadados, atualize o adapter e os arquivos de `querys` correspondentes.
- Não monte SQL com concatenação quando houver entrada do usuário; use mecanismos seguros do Knex/driver.
- Tenha cuidado com SQL executado livremente pelo usuário: não reescreva a query sem motivo.
- Em resultados tabulares, preserve paginação, metadados e compatibilidade entre PostgreSQL, MySQL e SQLite.

## Preload e IPC

- Mantenha `contextIsolation` compatível com o padrão atual.
- Se expuser nova API no preload, atualize também `src/preload/index.d.ts`.
- Prefira canais IPC nomeados no padrão atual, por exemplo:
  - `@get:...`
  - `@post:...`
  - `@delete:...`
  - `@event:...`
- Evite chamadas diretas do renderer a APIs Node/Electron fora da ponte permitida.

## TypeScript e tipos globais

- Tipos globais do main ficam em `src/main/@types`.
- Tipos globais do renderer ficam em `src/renderer/src/@types`.
- Tipos da ponte preload ficam em `src/preload/index.d.ts`.
- Prefira tipos explícitos em contratos entre main, preload e renderer.
- Ao mudar payload de IPC, sincronize chamada, handler e tipo relacionado.

## Validação antes de finalizar

- Mudança só no renderer:

```bash
rtk npm run typecheck:web
```

- Mudança só no main/preload:

```bash
rtk npm run typecheck:node
```

- Mudança transversal ou incerta:

```bash
rtk npm run typecheck
```

- Se não rodar validação, informe o motivo.
