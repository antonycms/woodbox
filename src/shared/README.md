# Código compartilhado

Contratos e funções usados por mais de uma camada, sem dependências de Node,
Electron, React, DOM ou bibliotecas de drivers.

- `types/`: contratos organizados por domínio; `index.ts` exporta apenas tipos.
- `utils/`: funções independentes de plataforma, importadas pelo arquivo específico.

No main, preload e renderer, use `@shared/types/...` e `@shared/utils/...`.
Tipos devem ser importados com `import type` diretamente no arquivo consumidor.
`shared` não deve importar nenhuma dessas três camadas.

## Limites preservados

- `IConnectionConfig` contém credenciais; `IConnectionPublic` não contém senhas.
  O `IConnection` de `main/database/types.ts` representa uma conexão Knex ativa
  e deve ser importado explicitamente, sem declaração global.
- `IScript` exige conteúdo; `IScriptMetadata` permite listagens sem conteúdo carregado.
- `SerializedRunSqlResult` exige linhas e colunas; `IRunSqlResult` também permite
  estados parciais usados pelo renderer.
- Parsers SQL de execução e de seleção no editor têm regras diferentes e não
  foram unificados. Builders DDL e tipos de linhas brutas dos drivers continuam locais.
- Helpers de filesystem, IPC e UI continuam nas respectivas camadas. Ser uma
  função pura não basta para movê-la: deve haver uso compartilhado real.

Não crie aliases globais nem reexports de compatibilidade nas outras camadas;
os consumidores devem importar diretamente do domínio em `shared`. O preload continua
responsável pela ponte Electron e por suas declarações globais, não pelos contratos
de domínio. Importar um tipo não disponibiliza dados nem expõe credenciais em runtime.

`generateHash` mantém o comportamento anterior e não serve para gerar segredos.
As funções de quoting tratam identificadores SQL, não valores de consultas.

## API e IPC

O renderer chama `window.api` conforme `types/api.ts`. Os canais de transporte
ficam em `types/ipc.ts` e são usados somente no preload e main. Não exponha uma
função genérica de `invoke`, `send` ou `on` ao renderer.

Novas operações precisam de método público, canal tipado, implementação explícita
no preload, schema de parâmetros em `main/ipc` e handler registrado por `addListener`.
Eventos passam apenas dados e devolvem uma função de cancelamento.

Falhas da API rejeitam com `IpcError`, não necessariamente uma instância de `Error`.
Use `getErrorMessage` para exibir mensagens; a propriedade `position` continua
disponível para os marcadores SQL.

## Validação

```sh
rtk npm run typecheck
rtk proxy node_modules/.bin/tsc -p tests/tsconfig.shared.json
rtk proxy node --experimental-strip-types --test tests/shared.test.ts tests/ipc.test.mjs tests/ssh.test.ts tests/ssh-storage.test.mjs
rtk npm run build
```

O tsconfig isolado verifica os contratos sem tipos globais de Node ou DOM;
o teste de dependências impede imports de fora de `shared`.
