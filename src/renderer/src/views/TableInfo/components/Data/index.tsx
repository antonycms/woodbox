import React from 'react';
import Table from '@renderer/components/Table2';
import { Spacer } from '@renderer/components/Spacer';
import { copyToClipboard } from '@renderer/utils/methods';
import { ContextMenu } from '@renderer/components/ContextMenu';
import {
  AddIcon,
  DuplicateIcon,
  IconRefresh,
  PanelFile,
  RemoveIcon,
  SaveIcon,
} from '@renderer/styles/icons';
import styles from './styles.module.css';
import { useStoreContext } from '@renderer/contexts/Store';
import { Button } from '@renderer/components/Button';
import { Input } from '@renderer/components/Input';
import { Text } from '@renderer/components/Text';
import { Bar } from '@renderer/components/Bar';
import { ITableInfoProps } from '../../dtos';
import { useTableInfoContext } from '@renderer/contexts/TableInfoContext';
import { toDateTime } from '@renderer/utils/date';
import { IColumn } from '@renderer/components/Table2/dtos';
import { useThemeContext } from '@renderer/contexts/Theme';

const Data = ({ id_connection, schema, table }: ITableInfoProps) => {
  const { activeTheme: { tableInfo: { data: theme } } } = useThemeContext();
  const { columns, loading: loadingTableInfo } = useTableInfoContext();

  const { getTableData } = useStoreContext();
  const [contextMenuTable, setContextMenuTable] = React.useState<IContextMenuTable>();
  const [items, setItems] = React.useState([]);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const lastPageSearch = React.useRef(page);
  const [limit, setLimit] = React.useState(200);
  const [lastFetchDate, setLastFetchDate] = React.useState(new Date());
  const [editedFieldsRows, setEditedFieldsRows] = React.useState<Map<React.Key, any>>(new Map());

  const isLoading = loadingTableInfo.columns || loading;

  const lastFetchDateSerialized = toDateTime(lastFetchDate);

  const columnsSerialized = columns.map<IColumn>((column) => ({
    label: column.column_name,
    attribute: column.column_name,
    // type: column.data_type,
    required: !!column.is_nullable,
    sortable: true,
  }));

  const handleChangeLimit = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLimit(Number(e.target.value));
  }, []);

  const onContextMenuTable = (
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    // data: IContextMenuData,
  ) => {
    setContextMenuTable({
      data: null,
      position: {
        x: event.clientX,
        y: event.clientY,
      },
    });
  };

  const handleSaveItems = () => {
    // if (!editedItems.length) return;
    // console.log(editedItems);
  };

  const handleAddItem = () => {
    // setItems((prevState) => [
    //   {
    //     id: 'kaskakdksa ',
    //     name: 'testando',
    //     age: null,
    //     dj: null,
    //     __table_hash_item: `${generateHash()}_${prevState.length}`,
    //     __style: { backgroundColor: theme.green, color: theme.dark },
    //     __table_disable_cell_edited_color: true,
    //   },
    //   ...prevState,
    // ]);
  };

  const loadData = React.useCallback(async () => {
    const newPage = page + 1;

    if (loading || newPage === lastPageSearch.current) return;

    setLoading(true);
    const { data } = await getTableData(id_connection, { schema, table, limit, page: newPage });
    setLoading(false);

    setLastFetchDate(new Date());

    lastPageSearch.current = newPage;

    if (!data.length) return;

    setPage(newPage);
    setItems((prevState) => [...prevState, ...data]);
  }, [id_connection, loading, schema, table, limit, page]);

  const handleRefresh = React.useCallback(async () => {
    if (loading) return;

    setLoading(true);
    const { data } = await getTableData(id_connection, { schema, table, limit: items.length, page: 1 });
    setLoading(false);

    lastPageSearch.current = 0;
    setLastFetchDate(new Date());
    setItems(data);
  }, [id_connection, items, loading, schema, table, limit, page]);

  const columnsFake = [
    {
      label: 'label 1',
      attribute: 'att_1',
    },
    {
      label: 'label 2',
      attribute: 'att_2',
    },
    {
      label: 'label 3',
      attribute: 'att_3',
    },
    {
      label: 'label 4',
      attribute: 'att_4',
    },
    {
      label: 'label 5',
      attribute: 'att_5',
    },
    {
      label: 'label 6',
      attribute: 'att_6',
    },
    {
      label: 'label 7',
      attribute: 'att_7',
    },
    {
      label: 'label 8',
      attribute: 'att_8',
    },
  ];

  const dataFake = (() => {
    const itemsFake = [];

    for (let i = 0; i < 1000; i++) {
      itemsFake.push({
        id: i,
        att_1: `att_${i + 1}`,
        att_2: `att_${i + 2}`,
        att_3: `att_${i + 3}`,
        att_4: `att_${i + 4}`,
        att_5: `att_${i + 5}`,
        att_6: `att_${i + 6}`,
        att_7: `att_${i + 7}`,
        att_8: `att_${i + 8}`,
      });
    }

    return itemsFake;
  })();

  const serializedData = React.useMemo(() => {
    if (!columns?.length) return [];

    return items.map((item) => {
      const row = { ...item };

      columnsSerialized.forEach(({ attribute }) => {
        const columnValue = row[attribute];

        if (typeof columnValue === 'object') {
          row[attribute] = JSON.stringify(columnValue);
        }
      });

      return row;
    });
  }, [items, columns]);

  React.useEffect(() => {
    loadData();
  }, []);

  return (
    <div className={styles.container}>
      <Table
        selectable
        columns={columnsSerialized}
        rows={serializedData}
        // columns={columnsFake}
        // rows={dataFake}
        rowKeyExtractor={(_, index) => index}
        onScrollEnd={loadData}
        loading={isLoading}
        onContextMenu={onContextMenuTable}
        editedRows={editedFieldsRows}
        onEditRow={(index, attribute, value) => {
          setEditedFieldsRows((prevState) => {
            const newState = new Map(prevState);

            const prevRowEdited = newState.get(index) || {};
            newState.set(index, { ...prevRowEdited, [attribute]: value });

            return newState;
          });
        }}
      />

      <Bar backgroundColor={theme.bar.backgroundColor} borderColor={theme.bar.borderColor}>
        <Button title="Salvar" text smallIcon color={theme.bar.color}>
          <SaveIcon size={16} />
        </Button>

        <Button title="Adicionar" text smallIcon color={theme.bar.color}>
          <AddIcon size={14} />
        </Button>

        <Button title="Duplicar itens selecionados" text smallIcon color={theme.bar.color}>
          <DuplicateIcon size={20} />
        </Button>

        <Button title="Remover itens selecionados" text smallIcon color={theme.bar.color}>
          <RemoveIcon size={16} />
        </Button>

        <Button title="Mostrar dados do vínculo" text smallIcon color={theme.bar.color}>
          <PanelFile size={16} />
        </Button>

        <Button title="Atualizar dados" text smallIcon color={theme.bar.color} onClick={handleRefresh}>
          <IconRefresh size={18} />
        </Button>

        <Input
          centerText
          title="Limite por busca"
          type="number"
          maxWidth="80px"
          value={limit}
          onChange={handleChangeLimit}
          backgroundColor={theme.bar.fieldBackgroundColor}
          color={theme.bar.fieldColor}
          placeholderColor={theme.bar.fieldPlaceholderColor}
        />

        <Spacer />

        <Text userSelect={false} color={theme.bar.color} title="Data da última atualização">
          Atualizado em {lastFetchDateSerialized}
        </Text>
      </Bar>

      <ContextMenu
        position={contextMenuTable?.position}
        onClose={() => setContextMenuTable(undefined)}
        options={[
          {
            text: 'Copiar',
            onClick: () =>
              copyToClipboard(
                contextMenuTable?.data?.selections
                  ?.map?.((item) => item[contextMenuTable?.data?.attribute])
                  ?.join?.('\n') || '',
              ),
          },
          {
            text: 'Copiar linha',
            onClick: () => copyToClipboard(contextMenuTable?.data?.selections),
          },
          { text: 'Definir como null' },
        ]}
      />
    </div>
  );
};

export default Data;

export interface IContextMenuTable {
  data: any;
  position: {
    x: number;
    y: number;
  };
}
