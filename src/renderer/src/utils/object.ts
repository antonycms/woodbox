export function setObjectProperty<Obj extends object, Key extends string, Value = unknown>(
  obj: Obj,
  key: Key,
  value: Value,
  noChangeObject?: boolean,
) {
  const objResult: Obj = noChangeObject ? JSON.parse(JSON.stringify(obj)) : obj;

  const keys = key.split('.');
  const lastIndex = keys.length - 1;

  let current: any = objResult;

  for (let index = 0; index < keys.length; index++) {
    const key = keys[index];

    if (index === lastIndex) {
      current[key] = value;
    } else {
      current[key] = current[key] || {};
      current = current[key];
    }
  }

  return objResult as Obj & NestedPath<Key, Value>;
}

export const getValueFromObjectByNestedAttribute = (obj: object, nestedAttribute: string): any => {
  const attributes = nestedAttribute.split('.') as (keyof object)[];
  return attributes.reduce((acc, attribute) => acc?.[attribute], obj);
};

export const checkIsEquals = (item1: any, item2: any): boolean => {
  if (!item1 && !item2) return true;
  if (!item1 || !item2) return false;

  if (typeof item1 !== typeof item2) return false;
  if (typeof item1 !== 'object') return item1 === item2;

  const attributesObj1 = Object.keys(item1 || {});
  const attributesObj2 = Object.keys(item2 || {});

  if (attributesObj1.length !== attributesObj2.length) return false;

  let match = true;

  for (const attribute of attributesObj1) {
    if (!match) break;

    const value1 = item1[attribute];
    const value2 = item2[attribute];

    if (typeof value1 !== typeof value2) match = false;
    else if (Array.isArray(value1) !== Array.isArray(value2)) match = false;
    else if (typeof value1 !== 'object') match = value1 === value2;
    else if (typeof value1 === 'object') match = checkIsEquals(value1 as object, value2 as object);
    else if (value1 !== value2) match = false;
  }

  return match;
};

export const getUniqueValueFromObjectKeys = <Obj extends object>(
  obj: Obj,
  keys: (keyof Obj)[],
  separatorValue = ', ',
) => {
  if (!obj || !Array.isArray(keys) || !keys.length) return null;

  if (keys.length === 1) return obj[keys[0]] as string;

  return keys.reduce((acm, key) => `${acm ? `${acm}${separatorValue}` : ''}${obj[key]}`, '');
};

export const createFormDataFromObject = <Obj extends object>(obj: Obj) => {
  const formData = new FormData();

  const applyValue = (key: string, value: any) => {
    if (value === undefined || value === null) return;

    formData.append(key, value as any);

    if (value instanceof File) {
      formData.set(key, value);
    } //
    else if (typeof value === 'string') {
      formData.set(key, value);
    } //
    else if (value !== undefined && value !== null) {
      formData.set(key, JSON.stringify(value));
    }
  };

  for (const key in obj) {
    const value = obj[key];

    if (Array.isArray(value)) {
      for (const v of value) applyValue(key, v);
    } //
    else {
      applyValue(key, value);
    }
  }

  return formData;
};
