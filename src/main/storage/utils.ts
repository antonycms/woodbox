import type Store from 'electron-store';

type StoredItem = { id: string };
type AppStore = Store<Record<string, unknown>>;
type StoredGetter<Item extends StoredItem> = {
  (): Item[];
  (id: string): Item | undefined;
};

const getStoredArray = <Item extends StoredItem>(store: AppStore, storeKey: string): Item[] => {
  return (store.get(storeKey) as Item[] | undefined) ?? [];
};

export const makeFnRemoveStoredItemFromArray = <Item extends StoredItem>(
  store: AppStore,
  storeKey: string,
) => {
  return (id: string) => {
    const prevItems = getStoredArray<Item>(store, storeKey);
    const updatedItems = prevItems.filter((item) => item.id !== id);

    store.set(storeKey, updatedItems);
  };
};

export const makeFnAddItemInStoredArray = <Item extends StoredItem>(
  store: AppStore,
  storeKey: string,
) => {
  return (item: Item) => {
    const prevItems = getStoredArray<Item>(store, storeKey);

    store.set(storeKey, [...prevItems, item]);
  };
};

export const makeFnGetItemInStoredArray = <Item extends StoredItem>(
  store: AppStore,
  storeKey: string,
) => {
  const getItem = ((id?: string) => {
    const items = getStoredArray<Item>(store, storeKey);

    if (!id) return items;

    return items.find((item) => item.id === id);
  }) as StoredGetter<Item>;

  return getItem;
};

export const makeFnEditItemInStoredArray = <Item extends StoredItem>(
  store: AppStore,
  storeKey: string,
) => {
  return (id: string, dataUpdated: Item) => {
    const items = getStoredArray<Item>(store, storeKey);

    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new Error(`Item with id "${id}" in stored[${storeKey}] does not exists`);
    }

    items[index] = dataUpdated;

    store.set(storeKey, items);
  };
};
