import type Store from 'electron-store';

export const makeFnRemoveStoredItemFromArray = (store: Store<any>, storeKey: string) => {
  return (id: string) => {
    const prevItems = store.get(storeKey);
    const updatedItems = prevItems.filter((item) => item.id !== id);

    store.set(storeKey, updatedItems);
  };
};

export const makeFnAddItemInStoredArray = (store: Store<any>, storeKey: string) => {
  return (item) => {
    const prevItems = store.get(storeKey);

    store.set(storeKey, [...prevItems, item]);
  };
};

export const makeFnGetItemInStoredArray = (store: Store<any>, storeKey: string) => {
  return (id: string) => {
    const items = store.get(storeKey) as any[];

    if (!id) return items;

    return items.find((item) => item.id === id);
  };
};

export const makeFnEditItemInStoredArray = (store: Store<any>, storeKey: string) => {
  return (id: string, dataUpdated) => {
    const items = store.get(storeKey) as any[];

    const index = items.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new Error(`Item with id "${id}" in stored[${storeKey}] does not exists`);
    }

    items[index] = dataUpdated;

    store.set(storeKey, items);
  };
};
