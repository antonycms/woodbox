export const arrayIsEquals = (array1: any[], array2: any[]) => {
  if (array1 === array2) return true;
  if (array1.length !== array2.length) return false;

  const check = array1.every((item, index) => {
    if (typeof array1[index] !== typeof array2[index]) return false;

    if (typeof item !== 'object') {
      return array1[index] === array2[index];
    } //
    else {
      if (!array2[index]) return false;

      const attributes = Object.keys(item);

      return attributes.every((attribute) => array1[index][attribute] === array2[index][attribute]);
    }
  });

  return check;
};
