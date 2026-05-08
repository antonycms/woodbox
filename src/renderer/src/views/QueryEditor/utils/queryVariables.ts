const VARIABLE_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

interface IQueryVariableOccurrence {
  name: string;
  start: number;
  end: number;
}

const isVariableNameChar = (char: string) => /[a-zA-Z0-9_]/.test(char);
const isVariableNameStart = (char: string) => /[a-zA-Z_]/.test(char);

const getQueryVariableOccurrences = (query: string): IQueryVariableOccurrence[] => {
  const occurrences: IQueryVariableOccurrence[] = [];
  let index = 0;

  while (index < query.length) {
    const char = query[index];
    const nextChar = query[index + 1];

    if (char === "'") {
      index++;

      while (index < query.length) {
        if (query[index] === "'" && query[index + 1] === "'") {
          index += 2;
          continue;
        }

        if (query[index] === "'") {
          index++;
          break;
        }

        index++;
      }

      continue;
    }

    if (char === '"') {
      index++;

      while (index < query.length) {
        if (query[index] === '"' && query[index + 1] === '"') {
          index += 2;
          continue;
        }

        if (query[index] === '"') {
          index++;
          break;
        }

        index++;
      }

      continue;
    }

    if (char === '-' && nextChar === '-') {
      index += 2;

      while (index < query.length && query[index] !== '\n') index++;

      continue;
    }

    if (char === '/' && nextChar === '*') {
      index += 2;

      while (index < query.length) {
        if (query[index] === '*' && query[index + 1] === '/') {
          index += 2;
          break;
        }

        index++;
      }

      continue;
    }

    if (char === '$') {
      const dollarQuoteMatch = query.slice(index).match(/^\$[a-zA-Z_][a-zA-Z0-9_]*\$|^\$\$/);

      if (dollarQuoteMatch) {
        const delimiter = dollarQuoteMatch[0];
        const endIndex = query.indexOf(delimiter, index + delimiter.length);

        index = endIndex >= 0 ? endIndex + delimiter.length : query.length;
        continue;
      }
    }

    if (char === '$' && nextChar === '{') {
      const endIndex = query.indexOf('}', index + 2);

      if (endIndex > index) {
        const name = query.slice(index + 2, endIndex).trim();

        if (VARIABLE_NAME_REGEX.test(name)) {
          occurrences.push({ name, start: index, end: endIndex + 1 });
          index = endIndex + 1;
          continue;
        }
      }
    }

    if (
      char === ':' &&
      nextChar !== ':' &&
      query[index - 1] !== ':' &&
      isVariableNameStart(nextChar || '')
    ) {
      let endIndex = index + 2;

      while (endIndex < query.length && isVariableNameChar(query[endIndex])) endIndex++;

      occurrences.push({ name: query.slice(index + 1, endIndex), start: index, end: endIndex });
      index = endIndex;
      continue;
    }

    index++;
  }

  return occurrences;
};

export const getQueryVariables = (query: string): string[] => {
  const variables = new Set<string>();

  getQueryVariableOccurrences(query).forEach(({ name }) => variables.add(name));

  return Array.from(variables);
};

export const prepareQueryVariables = (
  query: string,
  values: Record<string, string> = {},
): string => {
  const occurrences = getQueryVariableOccurrences(query);

  if (!occurrences.length) return query;

  let sql = '';
  let lastIndex = 0;

  occurrences.forEach(({ name, start, end }) => {
    sql += `${query.slice(lastIndex, start)}${values[name] ?? ''}`;
    lastIndex = end;
  });

  sql += query.slice(lastIndex);

  return sql;
};
