import React from 'react';
import {
  IColumnInfo,
  IColumnReferenceInfo,
  IColumnRestrictionsInfo,
  useStoreContext,
} from './Store';

const TableInfoContext = React.createContext<ITableInfoContext>({} as ITableInfoContext);

const TableInfoProvider = ({ children }: IThemeProviderProps) => {
  const { getTableColumns, getTableReferences, getTableUsedAsReference, getTableRestrictions, getTableDefinition } =
    useStoreContext();

  const [columns, setColumns] = React.useState<IColumnInfo[]>([]);
  const [references, setReferences] = React.useState<IColumnReferenceInfo[]>([]);
  const [usedAsReference, setUsedAsReference] = React.useState<IColumnReferenceInfo[]>([]);
  const [restrictions, setRestrictions] = React.useState<IColumnRestrictionsInfo[]>([]);
  const [definition, setDefinition] = React.useState<string>('');
  const [lastFetchDate, setLastFetchDate] = React.useState<ILastFetchDate>({
    columns: new Date(),
    references: new Date(),
    usedAsReference: new Date(),
    restrictions: new Date(),
    definition: new Date(),
  });
  const [loading, setLoading] = React.useState<ITableInfoLoading>({
    columns: false,
    references: false,
    usedAsReference: false,
    restrictions: false,
    definition: false,
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

        loadTableColumns,
        loadTableReferences,
        loadTableUsedAsReference,
        loadTableRestrictions,
        loadTableDefinition,

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

interface ITableInfo {
  columns: IColumnInfo[];
  references: IColumnReferenceInfo[];
  usedAsReference: IColumnReferenceInfo[];
  restrictions: IColumnRestrictionsInfo[];
  definition: string;
}

type ILastFetchDate = {
  [key in keyof ITableInfo]: Date;
};

type ITableInfoLoading = {
  [key in keyof ITableInfo]: boolean;
};

interface ITableInfoContext extends ITableInfo {
  loadTableColumns: LoadTableInfo;
  loadTableReferences: LoadTableInfo;
  loadTableUsedAsReference: LoadTableInfo;
  loadTableRestrictions: LoadTableInfo;
  loadTableDefinition: LoadTableInfo;

  lastFetchDate: ILastFetchDate;
  loading: ITableInfoLoading;
}

interface ILoadTableInfoFilters {
  table: string;
  schema: string;
}

export type LoadTableInfo = (idConnection: string, filters: ILoadTableInfoFilters) => Promise<void>;
