declare global {
  // Transforma "a.b.c" em ["a", "b", "c"]
  type Split<
    S extends string,
    Delimiter extends string,
  > = S extends `${infer Head}${Delimiter}${infer Tail}` ? [Head, ...Split<Tail, Delimiter>] : [S];

  // Constrói objeto nested a partir do array de chaves
  type NestedObject<Keys extends string[], Value> = Keys extends [
    infer Head extends string,
    ...infer Rest extends string[],
  ]
    ? { [K in Head]: NestedObject<Rest, Value> }
    : Value;

  // Exemplo: NestedPath<"a.b.c", number> vira { a: { b: { c: number } } }
  type NestedPath<Key extends string, Value> = NestedObject<Split<Key, '.'>, Value>;

  type Paths<T> = T extends object
    ? { [K in keyof T]: `${Exclude<K, symbol>}${'' | `.${Paths<T[K]>}`}` }[keyof T]
    : never;

  type Leaves<T> = T extends object
    ? {
        [K in keyof T]: `${Exclude<K, symbol>}${Leaves<T[K]> extends never
          ? ''
          : `.${Leaves<T[K]>}`}`;
      }[keyof T]
    : never;

  type PartialDeep<T> = T extends object
    ? {
        [P in keyof T]?: PartialDeep<T[P]>;
      }
    : T;

  type UndoPartial<T> = T extends Partial<infer R> ? R : T;
}

export {};
