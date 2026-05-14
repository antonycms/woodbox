export const arrayToCSV = (data: Record<string, unknown>[]): string => {
  if (!data?.length) return '';

  const headers = Object.keys(data[0]);
  const escape = (val: unknown) => {
    const str = val === null || val === undefined ? '' : String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n')
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const rows = data.map((row) => headers.map((h) => escape(row[h])).join(','));
  return [headers.join(','), ...rows].join('\n');
};

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

export const chunkArray = <Item = unknown>(myArray: Item[] = [], chunkSize: number) => {
  const localArr = [...myArray];
  const chunks: Item[][] = [];

  while (localArr.length) {
    chunks.push(localArr.splice(0, chunkSize));
  }

  return chunks;
};
