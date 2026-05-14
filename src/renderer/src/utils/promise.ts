export const executePromisesBatch = async <Item, ItemReturn>(
  array: Item[],
  callback: (item: Item, index: number) => Promise<ItemReturn>,
  batchSize = 4,
): Promise<ItemReturn[]> => {
  if (batchSize <= 0) {
    throw new Error('batchSize must be greater than 0');
  }

  const results: ItemReturn[] = [];

  for (let i = 0; i < array.length; i += batchSize) {
    const batch = array.slice(i, i + batchSize);

    const batchResults = await Promise.all(batch.map((item, i2) => callback(item, i + i2)));

    results.push(...batchResults);
  }

  return results;
};
