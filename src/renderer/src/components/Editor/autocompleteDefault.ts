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

const allWords = [...keywordsItems, ...operatorsItems, ...builtinFunctionsItems];

languages.registerCompletionItemProvider('sql', {
  provideCompletionItems: (model, position) => {
    const word = model.getWordUntilPosition(position);

    const range = {
      startLineNumber: position.lineNumber,
      endLineNumber: position.lineNumber,
      startColumn: word.startColumn,
      endColumn: word.endColumn,
    };

    const suggestions = allWords.map((item) => ({
      ...item,
      range,
    }));

    return {
      suggestions,
    };
  },
});

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
