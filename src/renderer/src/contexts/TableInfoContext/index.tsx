import React from 'react';

import {
  type IColumnInfo,
  type IColumnReferenceInfo,
  type IColumnRestrictionsInfo,
  type ITriggerInfo,
  useStoreContext,
} from '@renderer/contexts/Store';

import TableInfoContext, {
  type ILastFetchDate,
  type ITableInfo,
  type ITableInfoLoading,
  type LoadTableInfo,
} from './context';

export type * from './context';

const TableInfoProvider = ({ children }: IThemeProviderProps) => {
  const {
    getTableColumns,
    getTableReferences,
    getTableUsedAsReference,
    getTableRestrictions,
    getTableDefinition,
    getTableTriggers,
  } = useStoreContext();

  const [columns, setColumns] = React.useState<IColumnInfo[]>([]);
  const [references, setReferences] = React.useState<IColumnReferenceInfo[]>([]);
  const [usedAsReference, setUsedAsReference] = React.useState<IColumnReferenceInfo[]>([]);
  const [restrictions, setRestrictions] = React.useState<IColumnRestrictionsInfo[]>([]);
  const [definition, setDefinition] = React.useState<string>('');
  const [triggers, setTriggers] = React.useState<ITriggerInfo[]>([]);
  const [lastFetchDate, setLastFetchDate] = React.useState<ILastFetchDate>({
    columns: new Date(),
    references: new Date(),
    usedAsReference: new Date(),
    restrictions: new Date(),
    definition: new Date(),
    triggers: new Date(),
  });
  const [loading, setLoading] = React.useState<ITableInfoLoading>({
    columns: false,
    references: false,
    usedAsReference: false,
    restrictions: false,
    definition: false,
    triggers: false,
  });

  const updateFetchDate = (attribute: keyof ITableInfo) => {
    setLastFetchDate((prevState) => ({
      ...prevState,
      [attribute]: new Date(),
    }));
  };

  const updateLoading = (attribute: keyof ITableInfo, state: boolean) => {
    setLoading((prevState) => ({
      ...prevState,
      [attribute]: state,
    }));
  };

  const loadTableColumns: LoadTableInfo = React.useCallback(async (idConnection, filters) => {
    try {
      updateLoading('columns', true);

      const items = await getTableColumns(idConnection, filters);

      setColumns(items || []);
      updateFetchDate('columns');
    } finally {
      updateLoading('columns', false);
    }
  }, []);

  const loadTableReferences: LoadTableInfo = React.useCallback(async (idConnection, filters) => {
    try {
      updateLoading('references', true);

      const items = await getTableReferences(idConnection, filters);

      setReferences(items || []);
      updateFetchDate('references');
    } finally {
      updateLoading('references', false);
    }
  }, []);

  const loadTableUsedAsReference: LoadTableInfo = React.useCallback(
    async (idConnection, filters) => {
      try {
        updateLoading('usedAsReference', true);

        const items = await getTableUsedAsReference(idConnection, filters);

        setUsedAsReference(items || []);
        updateFetchDate('usedAsReference');
      } finally {
        updateLoading('usedAsReference', false);
      }
    },
    [],
  );

  const loadTableRestrictions: LoadTableInfo = React.useCallback(async (idConnection, filters) => {
    try {
      updateLoading('restrictions', true);

      const items = await getTableRestrictions(idConnection, filters);

      setRestrictions(items || []);
      updateFetchDate('restrictions');
    } finally {
      updateLoading('restrictions', false);
    }
  }, []);

  const loadTableTriggers: LoadTableInfo = React.useCallback(async (idConnection, filters) => {
    try {
      updateLoading('triggers', true);

      const items = await getTableTriggers(idConnection, filters);

      setTriggers(items || []);
      updateFetchDate('triggers');
    } finally {
      updateLoading('triggers', false);
    }
  }, []);

  const loadTableDefinition: LoadTableInfo = React.useCallback(async (idConnection, filters) => {
    try {
      updateLoading('definition', true);

      const items = await getTableDefinition(idConnection, filters);

      setDefinition(items?.[0]?.definition || '');
      updateFetchDate('definition');
    } finally {
      updateLoading('definition', false);
    }
  }, []);

  return (
    <TableInfoContext.Provider
      value={{
        columns,
        references,
        usedAsReference,
        restrictions,
        definition,
        triggers,

        loadTableColumns,
        loadTableReferences,
        loadTableUsedAsReference,
        loadTableRestrictions,
        loadTableDefinition,
        loadTableTriggers,

        lastFetchDate,
        loading,
      }}
    >
      {children}
    </TableInfoContext.Provider>
  );
};

export const useTableInfoContext = () => {
  return React.useContext(TableInfoContext);
};

export default TableInfoProvider;

interface IThemeProviderProps {
  children?: React.ReactNode;
}
