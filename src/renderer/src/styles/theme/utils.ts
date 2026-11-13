export function toCssProperties(obj: object) {
  const cssProperties: React.CSSProperties = {};

  for (const key in obj) {
    cssProperties[`--${key}`] = obj[key];
  }

  return cssProperties;
}

export const classes = (...params) => {
  let v = '';

  const add = (str: string) => {
    if (!str) return;
    v && (v += ' ');
    v += str;
  };

  for (const param of params) {
    if (!param) continue;

    if (typeof param === 'string' || typeof params === 'number') {
      add(param);
    } //
    else if (Array.isArray(param)) {
      for (const subParam of param) {
        add(classes(subParam));
      }
    } //
    else if (typeof param === 'object') {
      for (const attributeObj in param) {
        param[attributeObj] && add(attributeObj);
      }
    }
  }

  return v;
};
