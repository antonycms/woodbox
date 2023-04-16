import { languages } from 'monaco-editor';
import { language as sqlLanguage } from 'monaco-editor/esm/vs/basic-languages/sql/sql';

const sqlLanguageWithTs: ILanguage = sqlLanguage;

const { keywords, operators, builtinFunctions } = sqlLanguageWithTs;

const makeItem = (documentation: string, kind: languages.CompletionItemKind) => (word: string) => ({
  documentation,
  label: word,
  insertText: word,
  kind,
});

const operatorsItems = operators.map(
  makeItem('Operator SQL', languages.CompletionItemKind.Operator),
);
const builtinFunctionsItems = builtinFunctions.map(
  makeItem('Function SQL', languages.CompletionItemKind.Function),
);

const keywordsItems = keywords
  .filter((word) => !operators.includes(word) && !builtinFunctions.includes(word))
  .map(makeItem('Reserved Word SQL', languages.CompletionItemKind.Variable));

const sqlWords = [...keywordsItems, ...operatorsItems, ...builtinFunctionsItems];

interface IDefineSQlAutocompleteParams {
  schemas?: { name: string }[];
  tables: { name: string; schema?: string }[];
  columns?: { name: string; alias?: string }[];
  aliases?: { name: string }[];
}

export const defineSQlAutocomplete = ({
  schemas,
  aliases,
  columns = [],
  tables = [],
}: IDefineSQlAutocompleteParams) => {
  return languages.registerCompletionItemProvider('sql', {
    triggerCharacters: [' ', '.'],
    provideCompletionItems: (model, position) => {
      let availableWords: Omit<languages.CompletionItem, 'range'>[] = [...sqlWords];

      const currentWord = model.getWordAtPosition({
        lineNumber: position.lineNumber,
        column: Math.max(position.column - 1, 0),
      })?.word;

      const currentCharacter = model.getValueInRange({
        startLineNumber: position.lineNumber,
        endColumn: position.column,
        endLineNumber: position.lineNumber,
        startColumn: position.column - 1,
      });

      const isFromOrJoin = ['from', 'join'].includes(currentWord?.toLowerCase?.());

      if (currentCharacter === '.') {
        const isSchema = schemas?.some?.((schema) => schema.name === currentWord);
        const isAlias = aliases?.some?.((alias) => alias.name === currentWord);

        if (isSchema) {
          const tablesWords = tables
            .filter(({ schema }) => currentWord === schema)
            .map(({ name }) => makeItem('Tabela', languages.CompletionItemKind.Variable)(name));

          availableWords = [...tablesWords];
        }

        if (isAlias) {
          const columnsWords = columns
            .filter(({ alias }) => currentWord === alias)
            .map(({ name }) => makeItem('Alias', languages.CompletionItemKind.Variable)(name));

          availableWords = [...columnsWords];
        }
      } //
      else if (isFromOrJoin) {
        if (schemas) {
          const schemasWords = schemas.map(({ name }) =>
            makeItem('Esquema', languages.CompletionItemKind.Variable)(name),
          );

          availableWords = [...schemasWords];
        } //
        else {
          const tablesWords = tables.map(({ name }) =>
            makeItem('Tabela', languages.CompletionItemKind.Variable)(name),
          );

          availableWords = [...tablesWords];
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

interface ILanguage {
  defaultToken: string;
  tokenPostfix: string;
  ignoreCase: boolean;
  keywords: string[];
  operators: string[];
  builtinFunctions: string[];
  pseudoColumns: string[];
  brackets: {
    open: string;
    close: string;
    token: string;
  }[];
  tokenizer: {
    root: any;
    whitespace: any;
    comments: any;
    comment: any;
    pseudoColumns: any;
    numbers: any;
    strings: any;
    string: any;
    complexIdentifiers: any;
    bracketedIdentifier: any;
    quotedIdentifier: any;
    scopes: any;
  };
}
