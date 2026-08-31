# Arquitetura de dados por modelo — Woodbox

Data: 2026-08-29
Status: rascunho base

## 1. Objetivo

Preparar o Woodbox para suportar fontes mobile sem quebrar a arquitetura atual.

Para o MVP, o foco é só:

```txt
React Native + react-native-sqlite-storage → Woodbox → telas SQL atuais
```

A conexão mobile deve entrar como **novo dialeto relacional**:

```ts
type Dialect = 'postgres' | 'mysql' | 'sqlite' | 'react-native-sqlite';
```

Não adicionar `engine`, `model` ou roteador genérico agora. Isso seria abstração antes da hora.

## 2. Regra principal do MVP

`react-native-sqlite` é um dialeto separado, mas reaproveita o comportamento do SQLite:

- mesmas queries de metadados SQLite;
- mesmas telas relacionais atuais;
- mesmo Query Editor;
- mesma edição tabular;
- mesmo fluxo `Knex -> instance.raw(...)`.

A diferença fica isolada no client do Knex:

```txt
sqlite
  client: sqlite3
  connection: { filename }

react-native-sqlite
  client: ReactNativeBridgeSqliteClient
  connection: { reactNativeBridge }
```

Assim o `sqlite.ts` padrão não recebe condição de React Native, e o core não precisa saber se o SQLite veio de arquivo local ou de bridge.

## 3. Organização no main process para o MVP

Estrutura mínima:

```txt
src/main/database/
├── core.ts
├── types.ts
├── dialects/
│   ├── index.ts
│   ├── postgres.ts
│   ├── mysql.ts
│   ├── sqlite.ts
│   ├── reactNativeSqlite.ts
│   └── reactNativeBridgeSqliteClient.ts
└── queries/
    └── sqlite.ts

src/main/mobile/
└── reactNativeBridge/
    ├── index.ts
    ├── gateway.ts
    ├── protocol.ts
    ├── rpc.ts
    ├── service.ts
    └── sessions.ts
```

Responsabilidades:

- `database/core.ts`: continua genérico para dialetos Knex.
- `database/dialects/sqlite.ts`: continua só SQLite local.
- `database/dialects/reactNativeSqlite.ts`: novo dialeto que reaproveita SQLite e troca o client.
- `reactNativeBridgeSqliteClient.ts`: adapta chamadas do Knex para RPC via bridge.
- `mobile/reactNativeBridge`: infraestrutura WebSocket/RPC, sem regra de UI e sem lógica de metadados SQL.

## 4. Fluxo de execução RN SQLite

```txt
Renderer
  ↓ IPC atual
src/main/database/core.ts
  ↓ getDialectAdapter('react-native-sqlite')
reactNativeSqlite adapter
  ↓ Knex custom client
ReactNativeBridgeSqliteClient
  ↓
mobile/reactNativeBridge/service.ts
  ↓ WebSocket
app React Native
  ↓
react-native-sqlite-storage
```

O app não precisa ser reiniciado para refletir alterações, porque o SQL é executado dentro do próprio runtime do app aberto.

## 5. Configuração salva da conexão

Exemplo:

```json
{
  "id": "conn_123",
  "id_project": "proj_mobile",
  "description": "SQLite principal do app",
  "dialect": "react-native-sqlite",
  "environment": "development",
  "database": "SQLite principal",
  "host": "",
  "port": 0,
  "reactNativeBridge": {
    "appId": "meu-app-dev",
    "appName": "Meu App",
    "adapterId": "main",
    "adapterLabel": "SQLite principal",
    "port": 8123,
    "platform": "android"
  }
}
```

`sessionId` não deve ser persistido como identidade da conexão. Sessão é runtime; a identidade está em `appId + adapterId`.

## 6. Organização no renderer para o MVP

Estrutura mínima:

```txt
src/renderer/src/database/dialects/
├── index.ts
├── types.ts
├── sqlite.ts
└── reactNativeSqlite.ts

src/renderer/src/components/Sidebar/components/menus/ProjectsMenu/components/ModalNewConnection/
└── components/
    └── ReactNativeBridgeFields/
```

`reactNativeSqlite.ts` no renderer deve declarar:

```ts
const reactNativeSqlite = {
  ...sqlite,
  id: 'react-native-sqlite',
  label: 'React Native SQLite',
  editorDialect: 'sqlite',
  connectionMode: 'react-native-bridge',
};
```

O modal usa o seletor de dialeto existente. Ao selecionar `React Native SQLite`, ele exibe um campo `Porta da bridge` preenchido com `8123`, mantém a bridge ativa temporariamente nessa porta, lista app/adapters conectados e atualiza a lista a cada 3 segundos. Ao sair desse dialeto ou fechar o modal, essa retenção temporária é liberada. A bridge só permanece ativa se houver conexão `react-native-sqlite` aberta.

## 7. Organização futura por modelo

Quando MongoDB, Redis ou AsyncStorage entrarem, aí sim separar por comportamento:

```txt
src/main/database/
├── relational/
├── document/
└── keyValue/

src/renderer/src/views/
├── relational/
├── document/
└── keyValue/

src/renderer/src/database/
├── relational/
├── document/
└── keyValue/
```

Regras futuras:

- PostgreSQL, MySQL, SQLite e React Native SQLite ficam em `relational`.
- MongoDB fica em `document`.
- Redis e AsyncStorage ficam em `keyValue`.
- Hooks e componentes compartilhados continuam globais até haver repetição real.
- Não fazer MongoDB/Redis/AsyncStorage parecerem SQL.

## 8. Critérios de aceite do MVP

- Woodbox inicia gateway da bridge automaticamente ao selecionar `React Native SQLite`, usando a porta informada no modal.
- Bridge para quando não houver modal RN aberto nem conexão `react-native-sqlite` ativa.
- App RN conecta ao Woodbox.
- Woodbox lista adapters SQLite do app.
- Usuário cria conexão `react-native-sqlite`.
- Abrir conexão usa telas atuais de tabela/query.
- Query Editor executa SQL no app aberto.
- Edição tabular altera o SQLite via bridge.
- SQLite local continua isolado e funcionando.
- Core não tem condição específica para React Native.
- Typecheck passa.
