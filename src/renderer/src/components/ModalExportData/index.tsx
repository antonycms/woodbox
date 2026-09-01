import React from 'react';
import { Autocomplete } from '@renderer/components/Autocomplete';
import { Button } from '@renderer/components/Button';
import { Checkbox } from '@renderer/components/Checkbox';
import { Divider } from '@renderer/components/Divider';
import { Form } from '@renderer/components/Form';
import { Input } from '@renderer/components/Input';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import Table from '@renderer/components/Table';
import type { IColumn } from '@renderer/components/Table/dtos';
import { Text } from '@renderer/components/Text';
import {
  type ExportDataFormat,
  type ExportDataSource,
  useStoreContext,
} from '@renderer/contexts/Store';
import { useI18n, type TranslationKey } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import styles from './styles.module.css';

interface IModalExportDataProps {
  show?: boolean;
  idConnection?: string;
  source?: ExportDataSource;
  columns?: string[];
  previewRows?: Record<string, any>[];
  fileName?: string;
  onClose?(): void;
}

const FORMAT_OPTIONS: ExportDataFormat[] = ['csv', 'xlsx', 'json', 'jsonl'];
const FORMAT_LABELS: Record<ExportDataFormat, TranslationKey> = {
  csv: 'exportData.format.csv',
  xlsx: 'exportData.format.xlsx',
  json: 'exportData.format.json',
  jsonl: 'exportData.format.jsonl',
};
const FORMAT_ITEMS = FORMAT_OPTIONS.map((value) => ({ value }));
const EMPTY_COLUMNS: string[] = [];
const EMPTY_PREVIEW_ROWS: Record<string, any>[] = [];

const uniqueColumns = (columns: string[] = []) => [...new Set(columns.filter(Boolean))];

export const ModalExportData = React.memo((props: IModalExportDataProps) => {
  const {
    show,
    idConnection,
    source,
    columns: columnsProp,
    previewRows: previewRowsProp,
    fileName,
    onClose,
  } = props;
  const columns = columnsProp ?? EMPTY_COLUMNS;
  const previewRows = previewRowsProp ?? EMPTY_PREVIEW_ROWS;
  const { t, language } = useI18n();
  const { getExportDataPreview, exportData } = useStoreContext();
  const { showToast } = useToast();
  const {
    activeTheme: { modal: colors },
  } = useThemeContext();

  const [availableColumns, setAvailableColumns] = React.useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = React.useState<string[]>([]);
  const [rowsPreview, setRowsPreview] = React.useState<Record<string, any>[]>([]);
  const [format, setFormat] = React.useState<ExportDataFormat>('csv');
  const [batchSize, setBatchSize] = React.useState<string | number>(1000);
  const [showColumnsModal, setShowColumnsModal] = React.useState(false);
  const [loadingPreview, setLoadingPreview] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);

  const previewColumns = React.useMemo<IColumn[]>(
    () =>
      selectedColumns.map((column) => ({
        attribute: column,
        label: column,
      })),
    [selectedColumns],
  );

  const previewRowsSerialized = React.useMemo(
    () =>
      rowsPreview.map((row) =>
        selectedColumns.reduce<Record<string, any>>((acc, column) => {
          acc[column] = row?.[column];
          return acc;
        }, {}),
      ),
    [rowsPreview, selectedColumns],
  );

  const hasAllColumnsSelected =
    !!availableColumns.length && selectedColumns.length === availableColumns.length;

  const toggleColumn = React.useCallback((column: string) => {
    setSelectedColumns((prevState) =>
      prevState.includes(column)
        ? prevState.filter((item) => item !== column)
        : [...prevState, column],
    );
  }, []);

  const selectAllColumns = React.useCallback(() => {
    setSelectedColumns(availableColumns);
  }, [availableColumns]);

  const clearSelectedColumns = React.useCallback(() => {
    setSelectedColumns([]);
  }, []);

  const openColumnsModal = React.useCallback(() => {
    setShowColumnsModal(true);
  }, []);

  const closeColumnsModal = React.useCallback(() => {
    setShowColumnsModal(false);
  }, []);

  const handleClose = React.useCallback(() => {
    if (exporting) return;
    onClose?.();
  }, [exporting, onClose]);

  const handleFormatChange = React.useCallback(({ value }: { value: string | number | null }) => {
    if (value) setFormat(value as ExportDataFormat);
  }, []);

  const handleBatchSizeChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setBatchSize(event.target.value);
  }, []);

  const handleExport = React.useCallback(async () => {
    if (!idConnection || !source || exporting) return;

    if (!selectedColumns.length) {
      showToast({ type: 'warn', title: t('exportData.selectColumnsWarn') });
      return;
    }

    setExporting(true);

    try {
      const result = await exportData(idConnection, {
        source,
        columns: selectedColumns,
        format,
        batchSize: Number(batchSize),
        fileName,
      });

      if (result.canceled) return;

      showToast({
        type: 'success',
        title: t('toast.dataExported'),
        description: t('exportData.exportedRows', {
          count: result.rows.toLocaleString(language),
        }),
      });

      onClose?.();
    } catch (error) {
      showToast({
        type: 'error',
        title: t('toast.dataExportError'),
        description: error instanceof Error ? error.message : t('common.unknownError'),
        delay: 8000,
      });
    } finally {
      setExporting(false);
    }
  }, [
    batchSize,
    exportData,
    exporting,
    fileName,
    format,
    idConnection,
    language,
    onClose,
    selectedColumns,
    showToast,
    source,
    t,
  ]);

  React.useEffect(() => {
    if (!show) return;

    const nextColumns = uniqueColumns(columns);
    setAvailableColumns(nextColumns);
    setSelectedColumns(nextColumns);
    setRowsPreview(previewRows?.slice(0, 10) || []);
    setFormat('csv');
    setBatchSize(1000);
    setShowColumnsModal(false);
  }, [columns, previewRows, show]);

  React.useEffect(() => {
    if (!show || !idConnection || !source) return;
    if (previewRows && columns.length) return;

    let canceled = false;

    const loadPreview = async () => {
      setLoadingPreview(true);

      try {
        const preview = await getExportDataPreview(idConnection, { source });
        if (canceled) return;

        const nextColumns = uniqueColumns(columns.length ? columns : preview.columns);
        setAvailableColumns(nextColumns);
        setSelectedColumns(nextColumns);
        setRowsPreview(preview.rows || []);
      } catch (error) {
        if (canceled) return;

        showToast({
          type: 'error',
          title: t('toast.previewLoadError'),
          description: error instanceof Error ? error.message : t('common.unknownError'),
          delay: 8000,
        });
      } finally {
        if (!canceled) setLoadingPreview(false);
      }
    };

    loadPreview();

    return () => {
      canceled = true;
    };
  }, [columns, getExportDataPreview, idConnection, previewRows, show, showToast, source, t]);

  return (
    <>
      <Modal
        show={show}
        title={t('modal.exportData')}
        width="800px"
        maxHeight="86vh"
        closeOutside={!exporting}
        onClose={handleClose}
      >
        <Form id="modal_export_data_form" onSubmit={handleExport}>
          <div className={styles.container}>
            <Row>
              <Autocomplete
                xs={6}
                sm={3}
                md={3}
                required
                data={FORMAT_ITEMS}
                label={t('exportData.format')}
                value={format}
                disabled={exporting}
                clearable={false}
                color={colors.fieldColor}
                backgroundColor={colors.fieldBackgroundColor}
                labelColor={colors.color}
                extractLabel={(item) => t(FORMAT_LABELS[item.value])}
                extractValue={(item) => item.value}
                onChange={handleFormatChange}
              />

              <Input
                xs={6}
                sm={3}
                md={3}
                required
                type="number"
                label={t('exportData.batchSize')}
                value={batchSize}
                disabled={exporting}
                onChange={handleBatchSizeChange}
                color={colors.fieldColor}
                backgroundColor={colors.fieldBackgroundColor}
                labelColor={colors.color}
              />
            </Row>

            <Divider />

            <Text bold userSelect={false} color={colors.color}>
              {t('exportData.preview')}
            </Text>

            <div className={styles.previewTable}>
              {previewColumns.length ? (
                <div className={styles.previewTableInner}>
                  <Table
                    columns={previewColumns}
                    rows={previewRowsSerialized}
                    loading={loadingPreview}
                  />
                </div>
              ) : (
                <Text userSelect={false} color={colors.color}>
                  {loadingPreview ? t('common.loading') : t('exportData.emptyPreview')}
                </Text>
              )}
            </div>

            <Divider />

            <Row>
              <Button
                xs={12}
                sm={3}
                md={3}
                color={colors.neutralButtonColor || colors.color}
                backgroundColor={colors.fieldBackgroundColor}
                disabled={exporting || !availableColumns.length}
                onClick={openColumnsModal}
              >
                {t('exportData.selectedColumns', {
                  selected: selectedColumns.length,
                  total: availableColumns.length,
                })}
              </Button>
              
              <Spacer />

              <Button
                color={colors.cancelButtonColor}
                backgroundColor={colors.cancelButtonBackgroundColor}
                onClick={handleClose}
                disabled={exporting}
                xs={6}
                sm={3}
                md={2}
              >
                {t('settings.customization.cancel')}
              </Button>

              <Button
                type="submit"
                form="modal_export_data_form"
                color={colors.saveButtonColor}
                backgroundColor={colors.saveButtonBackgroundColor}
                loading={exporting}
                disabled={!selectedColumns.length || !source || !idConnection}
                xs={6}
                sm={3}
                md={2}
              >
                {t('common.export')}
              </Button>
            </Row>
          </div>
        </Form>
      </Modal>

      <Modal
        show={!!show && showColumnsModal}
        title={t('exportData.selectColumns')}
        width="420px"
        maxHeight="450px"
        closeOutside={!exporting}
        onClose={closeColumnsModal}
      >
        <div className={styles.columnsModalActions}>
          <Button
            text
            color={colors.color}
            disabled={exporting || hasAllColumnsSelected}
            onClick={selectAllColumns}
          >
            {t('common.selectAll')}
          </Button>

          <Button
            text
            color={colors.color}
            disabled={exporting || !selectedColumns.length}
            onClick={clearSelectedColumns}
          >
            {t('common.clear')}
          </Button>
        </div>

        <div className={styles.columnsModalList}>
          {availableColumns.map((column) => (
            <Checkbox
              key={column}
              label={column}
              title={column}
              checked={selectedColumns.includes(column)}
              disabled={exporting}
              color={colors.fieldColor}
              backgroundColor={colors.fieldBackgroundColor}
              labelColor={colors.color}
              onChecked={() => toggleColumn(column)}
            />
          ))}

          {!availableColumns.length && (
            <Text userSelect={false} color={colors.color}>
              {loadingPreview ? t('common.loading') : t('exportData.noColumns')}
            </Text>
          )}
        </div>

        <Divider />

        <Row>
          <Spacer />

          <Button
            color={colors.saveButtonColor}
            backgroundColor={colors.cancelButtonBackgroundColor}
            onClick={closeColumnsModal}
            xs={6}
            sm={4}
            md={3}
          >
            {t('common.close')}
          </Button>
        </Row>
      </Modal>
    </>
  );
});

ModalExportData.displayName = 'ModalExportData';
