/* eslint-disable prefer-const */
import { getCurrentQuerySqlFromContent } from '@renderer/utils/sql';
import { editor, languages } from './monaco';
import { language as sqlLanguage } from 'monaco-editor/languages/definitions/sql/sql';

const sqlLanguageWithTs: ILanguage = sqlLanguage;

const { keywords, operators, builtinFunctions } = sqlLanguageWithTs;

const makeItem =
  (documentation: string, kind: languages.CompletionItemKind, priority?: number) =>
  (word: string): IItem => ({
    documentation,
    label: word,
    insertText: word,
    kind,
    sortText: String(priority ?? 9),
  });

const operatorsItems = operators.map(
  makeItem('Operator SQL', languages.CompletionItemKind.Operator),
);
const builtinFunctionsItems = builtinFunctions.map(
  makeItem('Function SQL', languages.CompletionItemKind.Function),
);

const keywordsItems = keywords
  .filter((word) => !operators.includes(word) && !builtinFunctions.includes(word))
  .map(makeItem('Reserved Word SQL', languages.CompletionItemKind.Variable, 2));

const defaultSugestions = [...operatorsItems, ...builtinFunctionsItems, ...keywordsItems];

export interface IDefineSQlAutocompleteParams {
  schemas?: { name: string }[];
  tablesAvailable?: { name: string; schema?: string }[];
  tablesUsed?: { name: string; schema?: string; alias?: string }[];
  columns?: { name: string; table?: string; schema?: string }[];
}

const triggerCharacters = [' ', '.'];
const autocompleteParamsByModelUri = new Map<string, IDefineSQlAutocompleteParams>();
let autocompleteProviderDisposable:
  | ReturnType<typeof languages.registerCompletionItemProvider>
  | undefined;

const ensureSqlAutocompleteProvider = () => {
  if (autocompleteProviderDisposable) return;

  autocompleteProviderDisposable = languages.registerCompletionItemProvider('sql', {
    triggerCharacters,
    provideCompletionItems: (model, position) => {
      const params = autocompleteParamsByModelUri.get(model.uri.toString()) || {};
      const { schemas, columns = [], tablesAvailable = [], tablesUsed = [] } = params;
      const aliases = tablesUsed.filter((tableInfo) => tableInfo.alias);
      let availableWords: IItem[] = defaultSugestions;

      const value = model.getValueInRange({
        startColumn: 0,
        startLineNumber: 0,
        endColumn: position.column,
        endLineNumber: position.lineNumber,
      });

      const currentContent = getCurrentQuerySqlFromContent(value);

      const words = [];

      for (const word of currentContent.split(/[\n\r ]/)) {
        const trimmedWord = word?.trim?.();
        if (trimmedWord) words.push(trimmedWord);
      }

      const prevWord = words[words.length - 2];
      const currentWord = words[words.length - 1];

      const checkOperation = (op: string[]) => {
        const serializedCurrentWord = currentWord?.toLowerCase?.();
        const serializedPrevWord = prevWord?.toLowerCase?.();

        return op.includes(serializedCurrentWord) || op.includes(serializedPrevWord);
      };

      const tableAlias = aliases.find(({ alias }) => alias && currentWord?.startsWith(`${alias}.`));

      const isTable = tablesAvailable?.some?.(
        (table) => `${table.schema ? `${table.schema}.` : ''}${table.name}` === currentWord,
      );

      const isTypingCurrentWord = !/[\s]$/.test(currentContent);
      const isSchema =
        schemas?.some?.(
          (schema) => currentWord?.startsWith(schema.name) && currentWord?.includes('.'),
        ) &&
        (!isTable || isTypingCurrentWord);

      const isAlias =
        currentWord?.includes('.') &&
        !!tableAlias?.alias &&
        currentWord?.startsWith(`${tableAlias.alias}.`);
      const isSelectColumns = !isTable && checkOperation(['select']);
      const isFromOrJoin = !isTable && checkOperation(['from', 'join', 'update', 'into']);
      const isFilterOperators =
        !isTable &&
        checkOperation(['where', 'and', 'or', 'ilike', 'like', '=', '>', '>=', '<', '<=']);

      const isUpdateQuery = /^\s*UPDATE\s/i.test(currentContent);
      const isInsertQuery = /^\s*INSERT\s+INTO\s/i.test(currentContent);

      const isInUpdateSetClause =
        !isTable &&
        isUpdateQuery &&
        /\bSET\b/i.test(currentContent) &&
        !/\bSET\b.*\bWHERE\b/i.test(currentContent);

      const isUpdateSetColumns =
        isInUpdateSetClause && (checkOperation(['set']) || currentWord?.endsWith(','));

      const isInsertColumns =
        !isTable &&
        isInsertQuery &&
        currentContent.includes('(') &&
        (currentWord?.startsWith('(') || currentWord?.endsWith('(') || currentWord?.endsWith(','));

      if (isAlias) {
        const columnsWords = columns
          .filter(({ table, schema }) => table === tableAlias.name && schema === tableAlias.schema)
          .map(({ name }) => makeItem('Column', languages.CompletionItemKind.Variable, 0)(name));

        availableWords = columnsWords;
      } //
      else if (isSchema) {
        // const tablesWords = [];
        const tablesWords = tablesAvailable
          .filter(({ schema }) => currentWord?.split('.')[0] === schema)
          .map(({ name }) => makeItem('Tabela', languages.CompletionItemKind.Variable)(name));

        availableWords = tablesWords;
      } //
      else if (isSelectColumns) {
        const columnsWords = columns.map(({ name }) =>
          makeItem('Column', languages.CompletionItemKind.Variable, 0)(name),
        );
        availableWords = [...columnsWords, ...defaultSugestions];
      } //
      else if (isFromOrJoin) {
        if (schemas?.length) {
          const schemasWords = schemas.map(({ name }) =>
            makeItem('Esquema', languages.CompletionItemKind.Variable)(name),
          );

          availableWords = schemasWords;
        } //
        else {
          const tablesWords = tablesAvailable.map(({ name }) =>
            makeItem('Tabela', languages.CompletionItemKind.Variable)(name),
          );

          availableWords = tablesWords;
        }
      } //
      else if (isUpdateSetColumns || isInsertColumns) {
        availableWords = columns.map(({ name }) =>
          makeItem('Column', languages.CompletionItemKind.Variable)(name),
        );
      } //
      else if (isFilterOperators) {
        if (isAlias) {
          const columnsWords = columns
            .filter(
              ({ table, schema }) => table === tableAlias.name && schema === tableAlias.schema,
            )
            .map(({ name }) => makeItem('Column', languages.CompletionItemKind.Variable, 1)(name));

          availableWords = [...columnsWords];
        } //
        else {
          const aliasAvailable = aliases.map((alias) =>
            makeItem('Alias', languages.CompletionItemKind.Variable, 1)(alias.alias),
          );

          const columnsWords = columns.map(({ name }) =>
            makeItem('Column', languages.CompletionItemKind.Variable, 1)(name),
          );

          availableWords = [...columnsWords, ...aliasAvailable, ...defaultSugestions];
        }
      }

      const { lineNumber } = position;
      const { endColumn, startColumn } = model.getWordUntilPosition(position);

      const range = {
        startLineNumber: lineNumber,
        endLineNumber: lineNumber,
        startColumn,
        endColumn,
      };

      const suggestions = availableWords.map((item) => ({ ...item, range }));

      return { suggestions };
    },
  });
};

export const defineSQlAutocomplete = (
  model: editor.ITextModel,
  params: IDefineSQlAutocompleteParams = {},
) => {
  const modelUri = model.uri.toString();

  autocompleteParamsByModelUri.set(modelUri, params);
  ensureSqlAutocompleteProvider();

  return {
    dispose: () => {
      autocompleteParamsByModelUri.delete(modelUri);

      if (autocompleteParamsByModelUri.size) return;

      autocompleteProviderDisposable?.dispose();
      autocompleteProviderDisposable = undefined;
    },
  };
};

interface ILanguage {
  keywords: string[];
  operators: string[];
  builtinFunctions: string[];
}

interface IItem {
  documentation: string;
  label: string;
  insertText: string;
  kind: languages.CompletionItemKind;
  sortText: string;
}
