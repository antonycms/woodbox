import React from 'react';
import * as XLSX from 'xlsx';
import { Autocomplete } from '@renderer/components/Autocomplete';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { FilePicker } from '@renderer/components/FilePicker';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Input } from '@renderer/components/Input';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { DbCellValue, IColumnInfo, useStoreContext } from '@renderer/contexts/Store';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import useDebounce from '@renderer/hooks/useDebounce';
import styles from './styles.module.css';

type FileColumn = {
  key: string;
  label: string;
  originalName: string;
  index: number;
  valueIndex: number;
};

type ParsedFile = {
  fileName: string;
  columns: FileColumn[];
  rows: DbCellValue[][];
};

type ImportParserMessages = {
  noHeader: string;
  noValidColumns: string;
  noRows: string;
  csvSeparatorRequired: string;
  noSheets: string;
};

const normalizeColumnName = (value?: string) => {
  return String(value || '')
    .trim()
    .toLowerCase();
};

const normalizeCellValue = (value: unknown): DbCellValue => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return value;
  if (['string', 'number', 'boolean'].includes(typeof value)) return value as DbCellValue;

  return String(value);
};

const getFileColumnLabel = (name: string, occurrences: Map<string, number>) => {
  const count = occurrences.get(name) || 0;
  occurrences.set(name, count + 1);

  return count ? `${name} (${count + 1})` : name;
};

const parseMatrix = (
  fileName: string,
  matrix: unknown[][],
  messages: ImportParserMessages,
): ParsedFile => {
  const [headerRow, ...dataRows] = matrix;
  if (!headerRow?.length) throw new Error(messages.noHeader);

  const occurrences = new Map<string, number>();
  const columns = (
    headerRow
      .map((value) =>
        String(value ?? '')
          .replace(/^\uFEFF/, '')
          .trim(),
      )
      .map((name, index) => {
        if (!name) return null;

        return {
          key: `${name}__${index}`,
          label: getFileColumnLabel(name, occurrences),
          originalName: name,
          index,
        };
      })
      .filter(Boolean) as Omit<FileColumn, 'valueIndex'>[]
  ).map((column, valueIndex) => ({ ...column, valueIndex }));

  if (!columns.length) throw new Error(messages.noValidColumns);

  const rows = dataRows
    .map((row) => columns.map((column) => normalizeCellValue(row[column.index])))
    .filter((row) => row.some((value) => value !== null));

  if (!rows.length) throw new Error(messages.noRows);

  return { fileName, columns, rows };
};

const isCsvFile = (file: File) => file.name.toLowerCase().endsWith('.csv');

const decodeCsv = (buffer: ArrayBuffer) => {
  const utf8Text = new TextDecoder('utf-8').decode(buffer);

  if (!utf8Text.includes('\uFFFD')) return utf8Text;

  return new TextDecoder('windows-1252').decode(buffer);
};

const parseCsvRows = (text: string, separator: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (quoted) {
      if (char === '"' && nextChar === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }

      continue;
    }

    if (char === '"') {
      quoted = true;
      continue;
    }

    if (char === separator) {
      row.push(value);
      value = '';
      continue;
    }

    if (char === '\n' || char === '\r') {
      if (char === '\r' && nextChar === '\n') index += 1;

      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  row.push(value);
  rows.push(row);

  return rows.filter((csvRow) => csvRow.some((cell) => cell.trim() !== ''));
};

const parseImportFile = async (
  file: File,
  csvSeparator: string,
  messages: ImportParserMessages,
): Promise<ParsedFile> => {
  const buffer = await file.arrayBuffer();

  if (isCsvFile(file)) {
    const separator = csvSeparator === '\\t' ? '\t' : csvSeparator;
    if (!separator) throw new Error(messages.csvSeparatorRequired);

    return parseMatrix(file.name, parseCsvRows(decodeCsv(buffer), separator), messages);
  }

  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const firstSheetName = workbook.SheetNames[0];

  if (!firstSheetName) throw new Error(messages.noSheets);

  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: '',
    blankrows: false,
    raw: true,
  });

  return parseMatrix(file.name, matrix, messages);
};

export const ModalImportTableData = React.memo(
  ({ show, idConnection, schema, table, onClose }: IModalImportTableDataProps) => {
    const { getTableColumns, importTableData, loadConnectionInfo } = useStoreContext();
    const { t, language } = useI18n();
    const { showToast } = useToast();
    const {
      activeTheme: { settings, modal: colors },
    } = useThemeContext();

    const [loadingColumns, setLoadingColumns] = React.useState(false);
    const [loadingFile, setLoadingFile] = React.useState(false);
    const [importing, setImporting] = React.useState(false);
    const [tableColumns, setTableColumns] = React.useState<IColumnInfo[]>([]);
    const [parsedFile, setParsedFile] = React.useState<ParsedFile>();
    const [mapping, setMapping] = React.useState<Record<string, string>>({});
    const [selectedFile, setSelectedFile] = React.useState<File>();
    const [csvSeparator, setCsvSeparator] = React.useState(';');
    const [csvParsedSeparator, setCsvParsedSeparator] = React.useState(';');

    const tableName = [schema, table].filter(Boolean).join('.');
    const selectedFileIsCsv = selectedFile ? isCsvFile(selectedFile) : false;
    const mappedColumns = React.useMemo(
      () => Object.entries(mapping).filter(([, fileColumnKey]) => !!fileColumnKey),
      [mapping],
    );

    const parserMessages = React.useMemo<ImportParserMessages>(
      () => ({
        noHeader: t('import.noHeader'),
        noValidColumns: t('import.noValidColumns'),
        noRows: t('import.noRows'),
        csvSeparatorRequired: t('import.csvSeparatorRequired'),
        noSheets: t('import.noSheets'),
      }),
      [t],
    );

    const close = React.useCallback(() => {
      setTableColumns([]);
      setParsedFile(undefined);
      setMapping({});
      setSelectedFile(undefined);
      setCsvSeparator(';');
      setCsvParsedSeparator(';');
      onClose?.();
    }, [onClose]);

    const loadColumns = React.useCallback(async () => {
      if (!show || !idConnection || !table) return;

      try {
        setLoadingColumns(true);
        const columns = await getTableColumns(idConnection, { schema, table });
        setTableColumns(columns);
      } catch (error: any) {
        showToast({
          type: 'error',
          title: t('toast.loadTableColumnsError'),
          description: error?.message,
          delay: 8000,
        });
      } finally {
        setLoadingColumns(false);
      }
    }, [getTableColumns, idConnection, schema, show, showToast, table, t]);

    const loadFile = React.useCallback(
      async (file: File, separator: string) => {
        try {
          setLoadingFile(true);
          const parsed = await parseImportFile(file, separator, parserMessages);
          const fileColumnsByName = new Map(
            parsed.columns.map((column) => [normalizeColumnName(column.originalName), column.key]),
          );

          setParsedFile(parsed);
          setCsvParsedSeparator(isCsvFile(file) ? separator : '');
          setMapping(
            Object.fromEntries(
              tableColumns.map((column) => [
                column.column_name,
                fileColumnsByName.get(normalizeColumnName(column.column_name)) || '',
              ]),
            ),
          );
          return parsed;
        } catch (error: any) {
          setParsedFile(undefined);
          setMapping({});
          setCsvParsedSeparator('');
          showToast({
            type: 'error',
            title: t('toast.readFileError'),
            description: error?.message,
            delay: 8000,
          });
        } finally {
          setLoadingFile(false);
        }
      },
      [showToast, tableColumns, parserMessages, t],
    );

    const handleFileChange = React.useCallback(
      async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (!file) return;

        setSelectedFile(file);

        if (isCsvFile(file) && !csvSeparator) {
          setParsedFile(undefined);
          setMapping({});
          setCsvParsedSeparator('');
          return;
        }

        await loadFile(file, csvSeparator);
      },
      [csvSeparator, loadFile],
    );

    const loadCsvWithSeparatorDebounced = useDebounce((separator: string) => {
      if (!separator || !selectedFile || !isCsvFile(selectedFile)) return;
      if (csvParsedSeparator === separator) return;

      loadFile(selectedFile, separator);
    }, 500);

    const handleCsvSeparatorChange = React.useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value.slice(0, 2);
        setCsvSeparator(value);
        loadCsvWithSeparatorDebounced(value);
      },
      [loadCsvWithSeparatorDebounced],
    );

    const handleMappingChange = React.useCallback((tableColumn: string, fileColumnKey: string) => {
      setMapping((prevState) => ({ ...prevState, [tableColumn]: fileColumnKey }));
    }, []);

    const handleImport = React.useCallback(
      async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!mappedColumns.length) {
          return showToast({
            type: 'warn',
            title: t('toast.defineColumns'),
            description: t('toast.defineColumnsHelp'),
          });
        }

        try {
          setImporting(true);
          let fileData = parsedFile;

          if (selectedFile && isCsvFile(selectedFile) && csvParsedSeparator !== csvSeparator) {
            const parsed = await loadFile(selectedFile, csvSeparator);
            if (!parsed) return;

            fileData = parsed;
          }

          const rows = fileData.rows.map((row) =>
            Object.fromEntries(
              mappedColumns.map(([tableColumn, fileColumnKey]) => {
                const fileColumn = fileData.columns.find((column) => column.key === fileColumnKey);
                return [tableColumn, fileColumn ? row[fileColumn.valueIndex] : null];
              }),
            ),
          );

          const result = await importTableData(idConnection, { schema, table, rows });

          await loadConnectionInfo(idConnection);

          showToast({
            type: 'success',
            title: t('toast.dataImported'),
            description: t('import.importedRows', {
              count: result.insertedRows.toLocaleString(language),
            }),
          });

          close();
        } catch (error: any) {
          showToast({
            type: 'error',
            title: t('toast.dataImportError'),
            description: error?.message,
            delay: 8000,
          });
        } finally {
          setImporting(false);
        }
      },
      [
        close,
        idConnection,
        importTableData,
        loadConnectionInfo,
        loadFile,
        mappedColumns,
        parsedFile,
        schema,
        language,
        showToast,
        t,
        selectedFile,
        csvSeparator,
        csvParsedSeparator,
        table,
      ],
    );

    React.useEffect(() => {
      loadColumns();
    }, [loadColumns]);

    return (
      <Modal title={t('modal.importData')} width="640px" show={show}>
        <form
          className={styles.container}
          onSubmit={handleImport}
          style={
            {
              '--import-border-color': settings.importBorderColor,
              '--import-muted-color': settings.importMutedColor,
              '--import-field-background-color': colors.fieldBackgroundColor,
              '--import-field-color': colors.fieldColor,
            } as React.CSSProperties
          }
        >
          <Text userSelect={false} color={colors.color}>
            {t('field.table')}: <strong>{tableName}</strong>
          </Text>

          <Divider />

          <Row>
            <FilePicker
              label={t('field.excelOrCsvFile')}
              required
              accept=".xlsx,.xls,.csv"
              fileName={selectedFile?.name}
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
              labelColor={colors.fieldLabelColor}
              placeholderColor={settings.importMutedColor}
              disabled={loadingColumns || loadingFile || importing}
              onChange={handleFileChange}
              md={selectedFileIsCsv ? 10 : 12}
            />

            {selectedFileIsCsv && (
              <Input
                label={t('field.csvSeparator')}
                required
                value={csvSeparator}
                color={colors.fieldColor}
                backgroundColor={colors.fieldBackgroundColor}
                labelColor={colors.fieldLabelColor}
                disabled={importing}
                onChange={handleCsvSeparatorChange}
                md={2}
              />
            )}
          </Row>

          {!!loadingColumns && <Text color={colors.color}>{t('import.loadingColumns')}</Text>}
          {!!loadingFile && <Text color={colors.color}>{t('import.readingFile')}</Text>}

          {!!parsedFile && (
            <>
              <Divider />

              <Text color={colors.color} small>
                {t('import.fileSummary', {
                  fileName: parsedFile.fileName,
                  rows: parsedFile.rows.length.toLocaleString(language),
                  columns: parsedFile.columns.length.toLocaleString(language),
                })}
              </Text>

              <div className={styles.mappingHeader}>
                <span>{t('import.tableColumn')}</span>
                <span>{t('import.fileColumn')}</span>
              </div>

              <div className={styles.mappingList}>
                {tableColumns.map((column) => (
                  <div className={styles.mappingRow} key={column.column_name}>
                    <div>
                      <strong>{column.column_name}</strong>
                      <small>{column.data_type}</small>
                    </div>

                    <Autocomplete
                      data={parsedFile.columns}
                      value={mapping[column.column_name] || null}
                      placeholder={t('field.doNotImport')}
                      color={colors.fieldColor}
                      backgroundColor={colors.fieldBackgroundColor}
                      extractLabel={(fileColumn) => fileColumn.label}
                      extractValue={(fileColumn) => fileColumn.key}
                      onChange={({ value }) =>
                        handleMappingChange(column.column_name, String(value || ''))
                      }
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          <Divider />

          <Row>
            <Spacer />

            <Button
              color={colors.cancelButtonColor}
              backgroundColor={colors.cancelButtonBackgroundColor}
              disabled={importing}
              onClick={close}
              xs={6}
              sm={4}
              md={3}
            >
              {t('settings.customization.cancel')}
            </Button>

            <Button
              color={colors.saveButtonColor}
              backgroundColor={colors.saveButtonBackgroundColor}
              loading={importing}
              disabled={loadingColumns || loadingFile || !idConnection || !table}
              type="submit"
              xs={6}
              sm={4}
              md={3}
            >
              {t('modal.importData')}
            </Button>
          </Row>
        </form>
      </Modal>
    );
  },
);

ModalImportTableData.displayName = 'ModalImportTableData';

export interface IModalImportTableDataProps {
  show?: boolean;
  idConnection?: string;
  schema?: string;
  table?: string;
  onClose?: () => void;
}
