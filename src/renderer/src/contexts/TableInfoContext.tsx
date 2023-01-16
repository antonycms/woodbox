import React from 'react';
import {
  IColumnInfo,
  IColumnReferenceInfo,
  IColumnRestrictionsInfo,
  useStoreContext,
} from './Store';

const TableInfoContext = React.createContext<ITableInfoContext>({} as ITableInfoContext);

const TableInfoProvider = ({ children }: IThemeProviderProps) => {
  const { getTableColumns, getTableReferences, getTableRestrictions } = useStoreContext();

  const [columns, setColumns] = React.useState<IColumnInfo[]>([]);
  const [references, setReferences] = React.useState<IColumnReferenceInfo[]>([]);
  const [restrictions, setRestrictions] = React.useState<IColumnRestrictionsInfo[]>([]);
  const [lastFetchDate, setLastFetchDate] = React.useState<ILastFetchDate>({
    columns: new Date(),
    references: new Date(),
    restrictions: new Date(),
  });
  const [loading, setLoading] = React.useState<ITableInfoLoading>({
    columns: false,
    references: false,
    restrictions: false,
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
    } catch (error) {
      throw error;
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
    } catch (error) {
      throw error;
    } finally {
      updateLoading('references', false);
    }
  }, []);

  const loadTableRestrictions: LoadTableInfo = React.useCallback(async (idConnection, filters) => {
    try {
      updateLoading('restrictions', true);

      const items = await getTableRestrictions(idConnection, filters);

      setRestrictions(items || []);
      updateFetchDate('restrictions');
    } catch (error) {
      throw error;
    } finally {
      updateLoading('restrictions', false);
    }
  }, []);

  return (
    <TableInfoContext.Provider
      value={{
        columns,
        references,
        restrictions,

        loadTableColumns,
        loadTableReferences,
        loadTableRestrictions,

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
  restrictions: IColumnRestrictionsInfo[];
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
  loadTableRestrictions: LoadTableInfo;

  lastFetchDate: ILastFetchDate;
  loading: ITableInfoLoading;
}

interface ILoadTableInfoFilters {
  table: string;
  schema: string;
}

export type LoadTableInfo = (idConnection: string, filters: ILoadTableInfoFilters) => Promise<void>;
