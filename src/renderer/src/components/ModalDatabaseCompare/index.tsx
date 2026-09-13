import React from 'react';
import { Autocomplete } from '@renderer/components/Autocomplete';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Form } from '@renderer/components/Form';
import { Row } from '@renderer/components/Grid';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useI18n } from '@renderer/contexts/I18n';
import {
  type IConnection,
  type IDatabaseCompareItem,
  type IDatabaseCompareMessage,
  type IDatabaseCompareObjectSelection,
  type IDatabaseCompareResult,
  useStoreContext,
} from '@renderer/contexts/Store';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import { getRendererDialect } from '@renderer/database/dialects';
import { DEFAULT_OPTIONS, KIND_LABEL_KEY, MESSAGE_LABEL_KEY, OPERATION_LABEL_KEY } from './constants';
import { DdlModal } from './components/DdlModal';
import { ObjectsModal } from './components/ObjectsModal';
import type { DatabaseCompareSelectableObject, IModalDatabaseCompareProps } from './types';
import { filterObject, getGroupKey, getObjectKey, groupObjects, mergeFunctions, mergeTables } from './utils';
import styles from './styles.module.css';

const RESULT_OPERATIONS = ['modify', 'create', 'delete'] as const;

const OPERATION_CLASS = {
  modify: styles.modify,
  create: styles.create,
  delete: styles.delete,
  none: styles.none,
} as const;

export const ModalDatabaseCompare = React.memo((props: IModalDatabaseCompareProps) => {
  const { show, onClose } = props;
  const { t } = useI18n();
  const { showToast } = useToast();
  const { connections, connectionsInfo, loadConnectionInfo, compareDatabases } = useStoreContext();
  const {
    activeTheme: { table: tableTheme, mainTab, modal: modalTheme },
  } = useThemeContext();

  const [sourceConnectionId, setSourceConnectionId] = React.useState<string>();
  const [targetConnectionId, setTargetConnectionId] = React.useState<string>();
  const [selectedObjectsKeys, setSelectedObjectsKeys] = React.useState<string[]>([]);
  const [collapsedSchemas, setCollapsedSchemas] = React.useState<string[]>([]);
  const [showObjectsModal, setShowObjectsModal] = React.useState(false);
  const [filterText, setFilterText] = React.useState('');
  const [loadingConnectionIds, setLoadingConnectionIds] = React.useState<string[]>([]);
  const [loadingCompare, setLoadingCompare] = React.useState(false);
  const [result, setResult] = React.useState<IDatabaseCompareResult>();
  const [selectedResultItem, setSelectedResultItem] = React.useState<IDatabaseCompareItem>();
  const [collapsedResultOperations, setCollapsedResultOperations] = React.useState<string[]>([]);

  const sourceConnection = React.useMemo(
    () => connections.find((connection) => connection.id === sourceConnectionId),
    [connections, sourceConnectionId],
  );
  const targetConnection = React.useMemo(
    () => connections.find((connection) => connection.id === targetConnectionId),
    [connections, targetConnectionId],
  );

  const sourceInfo = sourceConnectionId ? connectionsInfo.get(sourceConnectionId) : undefined;
  const targetInfo = targetConnectionId ? connectionsInfo.get(targetConnectionId) : undefined;

  const supportsSchemas = React.useMemo(() => {
    return getRendererDialect(sourceConnection?.dialect || targetConnection?.dialect).supportsSchemas;
  }, [sourceConnection?.dialect, targetConnection?.dialect]);

  const allTables = React.useMemo(() => {
    return mergeTables(sourceInfo?.tables || [], targetInfo?.tables || []);
  }, [sourceInfo?.tables, targetInfo?.tables]);

  const allFunctions = React.useMemo(() => {
    return mergeFunctions(sourceInfo?.functions || [], targetInfo?.functions || []);
  }, [sourceInfo?.functions, targetInfo?.functions]);

  const selectableObjects = React.useMemo<DatabaseCompareSelectableObject[]>(() => {
    return [
      ...allTables.map((table) => ({
        type: 'table' as const,
        schema: table.table_schema,
        name: table.table_name,
        table,
      })),
      ...allFunctions.map((fn) => ({
        type: 'function' as const,
        schema: fn.function_schema,
        name: fn.function_name,
        functionIdentityArguments: fn.function_identity_arguments,
        function: fn,
      })),
    ];
  }, [allFunctions, allTables]);

  const filteredGroups = React.useMemo(() => {
    return groupObjects(
      selectableObjects.filter((object) => filterObject(object, filterText)),
      supportsSchemas,
    );
  }, [filterText, selectableObjects, supportsSchemas]);

  const selectedObjectSet = React.useMemo(() => new Set(selectedObjectsKeys), [selectedObjectsKeys]);
  const collapsedSchemaSet = React.useMemo(() => new Set(collapsedSchemas), [collapsedSchemas]);

  const selectedObjects = React.useMemo<IDatabaseCompareObjectSelection[]>(() => {
    return selectableObjects
      .filter((object) => selectedObjectSet.has(getObjectKey(object)))
      .map((object) => ({
        type: object.type,
        schema: object.schema,
        name: object.name,
        table: object.type === 'table' ? object.name : undefined,
        functionIdentityArguments:
          object.type === 'function' ? object.functionIdentityArguments : undefined,
      }));
  }, [selectableObjects, selectedObjectSet]);

  const allResultDdl = React.useMemo(() => {
    return (result?.items || [])
      .map((item) => item.ddl?.trim())
      .filter((ddl): ddl is string => !!ddl)
      .join('\n\n');
  }, [result?.items]);

  const loadInfo = React.useCallback(
    async (connectionId?: string) => {
      if (!connectionId || connectionsInfo.has(connectionId)) return;

      setLoadingConnectionIds((prev) => [...prev, connectionId]);
      try {
        await loadConnectionInfo(connectionId);
      } catch (error) {
        showToast({
          type: 'error',
          title: t('toast.connectionError'),
          description: error instanceof Error ? error.message : String(error),
        });
      } finally {
        setLoadingConnectionIds((prev) => prev.filter((id) => id !== connectionId));
      }
    },
    [connectionsInfo, loadConnectionInfo, showToast, t],
  );

  const handleClose = React.useCallback(() => {
    if (loadingCompare) return;
    onClose?.();
  }, [loadingCompare, onClose]);

  const openObjectsModal = React.useCallback(() => {
    setCollapsedSchemas(filteredGroups.map(getGroupKey));
    setShowObjectsModal(true);
  }, [filteredGroups]);

  const closeObjectsModal = React.useCallback(() => {
    setShowObjectsModal(false);
  }, []);

  const toggleObject = React.useCallback((object: DatabaseCompareSelectableObject) => {
    const key = getObjectKey(object);
    setSelectedObjectsKeys((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  }, []);

  const toggleGroup = React.useCallback((objects: DatabaseCompareSelectableObject[]) => {
    const keys = objects.map(getObjectKey);
    setSelectedObjectsKeys((prev) => {
      const current = new Set(prev);
      const allSelected = keys.every((key) => current.has(key));
      keys.forEach((key) => (allSelected ? current.delete(key) : current.add(key)));
      return [...current];
    });
  }, []);

  const toggleSchemaVisibility = React.useCallback((groupKey: string) => {
    setCollapsedSchemas((prev) =>
      prev.includes(groupKey) ? prev.filter((item) => item !== groupKey) : [...prev, groupKey],
    );
  }, []);

  const toggleResultOperation = React.useCallback((operation: string) => {
    setCollapsedResultOperations((prev) =>
      prev.includes(operation) ? prev.filter((item) => item !== operation) : [...prev, operation],
    );
  }, []);

  const getResultItemLabel = React.useCallback(
    (item: IDatabaseCompareItem) => {
      if (item.label) return item.label;

      const data = item.display || item.source || item.target;
      if (!data?.name) return t('databaseCompare.noDifferencesFound');

      const name = [data.schema, data.parentName, data.name].filter(Boolean).join('.');
      if (item.display?.targetName) {
        const targetName = [data.schema, data.parentName, item.display.targetName].filter(Boolean).join('.');
        return `${targetName} → ${name}`;
      }
      return name;
    },
    [t],
  );

  const getCompareMessage = React.useCallback(
    (message: IDatabaseCompareMessage) => {
      return t(MESSAGE_LABEL_KEY[message.code], message.values);
    },
    [t],
  );

  const viewAllDdl = React.useCallback(() => {
    if (!allResultDdl) return;

    setSelectedResultItem({
      id: 'all_ddls',
      operation: 'modify',
      kind: 'table',
      label: t('databaseCompare.allDdlTitle'),
      ddl: allResultDdl,
    });
  }, [allResultDdl, t]);

  const runCompare = React.useCallback(async () => {
    if (!sourceConnectionId || !targetConnectionId) return;
    if (!selectedObjects.length) {
      showToast({ type: 'warn', title: t('databaseCompare.selectObjectsWarning') });
      return;
    }

    setLoadingCompare(true);
    try {
      const compareResult = await compareDatabases({
        sourceConnectionId,
        targetConnectionId,
        selectedObjects,
        options: DEFAULT_OPTIONS,
      });
      setCollapsedResultOperations(
        RESULT_OPERATIONS.filter((operation) =>
          compareResult.items.some((item) => item.operation === operation),
        ),
      );
      setResult(compareResult);
    } catch (error) {
      showToast({
        type: 'error',
        title: t('databaseCompare.compareFailed'),
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoadingCompare(false);
    }
  }, [
    compareDatabases,
    selectedObjects,
    showToast,
    sourceConnectionId,
    targetConnectionId,
    t,
  ]);

  React.useEffect(() => {
    loadInfo(sourceConnectionId);
  }, [loadInfo, sourceConnectionId]);

  React.useEffect(() => {
    loadInfo(targetConnectionId);
  }, [loadInfo, targetConnectionId]);

  // React.useEffect(() => {
  //   setSelectedObjectsKeys([]);
  //   setCollapsedSchemas([]);
  //   setFilterText('');
  //   setResult(undefined);
  //   setSelectedResultItem(undefined);
  // }, [sourceConnectionId, targetConnectionId]);

  return (
    <>
      <Modal
        show={show}
        title={t('databaseCompare.title')}
        width="900px"
        maxHeight="800px"
        closeOutside={!loadingCompare}
        onClose={handleClose}
      >
        <Form id="modal_database_compare_form" onSubmit={runCompare}>
          <div
            className={styles.container}
            style={
              {
                color: modalTheme.color,
                '--database-compare-row-background-color': modalTheme.fieldBackgroundColor,
              } as React.CSSProperties
            }
          >
            <Row>
              <Autocomplete<IConnection>
                xs={12}
                sm={6}
                md={6}
                required
                label={t('databaseCompare.sourceConnection')}
                data={connections}
                value={sourceConnectionId}
                loading={!!sourceConnectionId && loadingConnectionIds.includes(sourceConnectionId)}
                color={modalTheme.fieldColor}
                backgroundColor={modalTheme.fieldBackgroundColor}
                labelColor={modalTheme.color}
                placeholder={t('databaseCompare.selectConnection')}
                extractLabel={(connection) => connection.description}
                extractValue={(connection) => connection.id}
                onChange={({ value }) => setSourceConnectionId(value as string)}
              />

              <Autocomplete<IConnection>
                xs={12}
                sm={6}
                md={6}
                required
                label={t('databaseCompare.targetConnection')}
                data={connections}
                value={targetConnectionId}
                loading={!!targetConnectionId && loadingConnectionIds.includes(targetConnectionId)}
                color={modalTheme.fieldColor}
                backgroundColor={modalTheme.fieldBackgroundColor}
                labelColor={modalTheme.color}
                placeholder={t('databaseCompare.selectConnection')}
                extractLabel={(connection) => connection.description}
                extractValue={(connection) => connection.id}
                onChange={({ value }) => setTargetConnectionId(value as string)}
              />
            </Row>

            {!!result && (
              <Divider color={modalTheme.fieldBackgroundColor} />
            )}

            {!!result?.warnings.length && (
              <div className={styles.warning}>
                {result.warnings.map((warning, index) => (
                  <Text key={`${warning.code}_${index}`} small color={modalTheme.color} userSelect={false}>
                    {getCompareMessage(warning)}
                  </Text>
                ))}
              </div>
            )}

            {!!result && (
              <div className={styles.resultList}>
                {RESULT_OPERATIONS.map((operation) => {
                  const items = result.items.filter((item) => item.operation === operation);
                  if (!items.length) return null;

                  const isCollapsed = collapsedResultOperations.includes(operation);

                  return (
                    <div
                      key={operation}
                      className={`${styles.resultGroup} ${OPERATION_CLASS[operation]}`}
                    >
                      <button
                        type="button"
                        className={styles.resultHeader}
                        onClick={() => toggleResultOperation(operation)}
                      >
                        <Text bold color={tableTheme.colorHeader} userSelect={false}>
                          {t(OPERATION_LABEL_KEY[operation])}
                        </Text>
                        <span className={styles.resultHeaderInfo}>
                          <Text small color={tableTheme.colorHeader} userSelect={false}>
                            {t('databaseCompare.resultCount', { count: items.length })}
                          </Text>
                          <span className={styles.resultHeaderIcon}>{isCollapsed ? '+' : '−'}</span>
                        </span>
                      </button>

                      {!isCollapsed &&
                        items.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className={styles.resultItem}
                            disabled={!item.ddl}
                            onClick={() => setSelectedResultItem(item)}
                          >
                            <span>{getResultItemLabel(item)}</span>
                            <small>{t(KIND_LABEL_KEY[item.kind])}</small>
                          </button>
                        ))}
                    </div>
                  );
                })}

                {!!allResultDdl && (
                  <>
                    <Divider />
                    <Row>
                      <Spacer />
                      <Button
                        text
                        color={modalTheme.fieldColor}
                        backgroundColor={modalTheme.fieldBackgroundColor}
                        onClick={viewAllDdl}
                        xs={6}
                        sm={4}
                        md={3}
                      >
                        {t('databaseCompare.viewAllDdl')}
                      </Button>
                    </Row>
                  </>
                )}

                {result.items.every((item) => item.operation === 'none') && (
                  <Text small color={modalTheme.color} userSelect={false}>
                    {t('databaseCompare.noDifferencesFound')}
                  </Text>
                )}
              </div>
            )}

            {!!result && (
              <Divider color={modalTheme.fieldBackgroundColor} />
            )}
          </div>

          <Row>
              <Button
                xs={12}
                sm={3}
                md={3}
                color={modalTheme.neutralButtonColor || modalTheme.color}
                backgroundColor={modalTheme.fieldBackgroundColor}
                disabled={loadingCompare}
                onClick={openObjectsModal}
              >
                {t('databaseCompare.selectedObjects', {
                  selected: selectedObjects.length,
                  total: selectableObjects.length,
                })}
              </Button>

              <Spacer />

              <Button
                text
                color={modalTheme.cancelButtonColor}
                backgroundColor={modalTheme.cancelButtonBackgroundColor}
                onClick={onClose}
                xs={12}
                sm={3}
                md={3}
              >
                {t('common.close')}
              </Button>

              <Button
                type="submit"
                form="modal_database_compare_form"
                loading={loadingCompare}
                backgroundColor={modalTheme.saveButtonBackgroundColor}
                color={modalTheme.saveButtonColor}
                xs={12}
                md={3}
                sm={3}
              >
                {t('databaseCompare.compare')}
              </Button>
            </Row>
        </Form>
      </Modal>

      <ObjectsModal
        show={!!show && showObjectsModal}
        filterText={filterText}
        groups={filteredGroups}
        selectedObjectSet={selectedObjectSet}
        collapsedSchemaSet={collapsedSchemaSet}
        loading={loadingCompare}
        onClose={closeObjectsModal}
        onFilterTextChange={setFilterText}
        onToggleGroup={toggleGroup}
        onToggleObject={toggleObject}
        onToggleSchemaVisibility={toggleSchemaVisibility}
      />


      <DdlModal
        item={show ? selectedResultItem : undefined}
        title={selectedResultItem ? getResultItemLabel(selectedResultItem) : undefined}
        onClose={() => setSelectedResultItem(undefined)}
      />
    </>
  );
});

ModalDatabaseCompare.displayName = 'ModalDatabaseCompare';
