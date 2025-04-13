export const generateHash = (len = 5) => {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;

  for (let i = 0; i < len; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }

  return result;
};

export const checkOnlyNumberInString = (text: string) => /^[0-9]*$/.test(text);

export function textToSnakeCase(text: string, prefix?: string) {
  if (typeof text !== 'string') return text;

  const serializedTextArr = text
    .match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g)
    .map((s) => s.toLowerCase().trim());

  prefix && serializedTextArr.unshift(prefix);

  return serializedTextArr.join('_');
}
