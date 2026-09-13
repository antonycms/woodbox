import React from 'react';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Row } from '@renderer/components/Grid';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { VirtualizeList } from '@renderer/components/VirtualizeList';
import { useI18n } from '@renderer/contexts/I18n';
import type { TranslationKey } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import type { DatabaseCompareSelectableObject, IObjectsModalProps } from '../../types';
import { getGroupKey, getObjectDisplayName, getObjectKey, getObjectTypeLabel } from '../../utils';
import styles from './styles.module.css';

type ObjectListItem =
  | {
      type: 'schema';
      groupKey: string;
      label: string;
      objects: DatabaseCompareSelectableObject[];
      selectedCount: number;
      allSelected: boolean;
      isCollapsed: boolean;
    }
  | {
      type: 'object';
      object: DatabaseCompareSelectableObject;
    };

export const ObjectsModal = React.memo((props: IObjectsModalProps) => {
  const {
    show,
    filterText,
    groups,
    selectedObjectSet,
    collapsedSchemaSet,
    loading,
    onClose,
    onFilterTextChange,
    onToggleGroup,
    onToggleObject,
    onToggleSchemaVisibility,
  } = props;
  const { t } = useI18n();
  const {
    activeTheme: { modal: modalTheme },
  } = useThemeContext();

  const listItems = React.useMemo<ObjectListItem[]>(() => {
    return groups.flatMap((group) => {
      const groupKey = getGroupKey(group);
      const groupKeys = group.objects.map(getObjectKey);
      const selectedCount = groupKeys.filter((key) => selectedObjectSet.has(key)).length;
      const isCollapsed = collapsedSchemaSet.has(groupKey);
      const header: ObjectListItem = {
        type: 'schema',
        groupKey,
        label: group.label,
        objects: group.objects,
        selectedCount,
        allSelected: !!group.objects.length && selectedCount === group.objects.length,
        isCollapsed,
      };

      if (isCollapsed) return [header];

      return [header, ...group.objects.map((object): ObjectListItem => ({ type: 'object', object }))];
    });
  }, [collapsedSchemaSet, groups, selectedObjectSet]);

  const getSchemaLabel = React.useCallback(
    (label: string) => {
      const translationKeys: TranslationKey[] = ['databaseCompare.noSchema'];
      const key = translationKeys.find((item) => item === label);

      return key ? t(key) : label;
    },
    [t],
  );

  return (
    <Modal
      show={show}
      title={t('databaseCompare.selectObjects')}
      width="520px"
      maxHeight="620px"
      closeOutside={!loading}
      onClose={onClose}
    >
      <Input
        value={filterText}
        placeholder={t('common.filter')}
        color={modalTheme.fieldColor}
        backgroundColor={modalTheme.fieldBackgroundColor}
        placeholderColor={modalTheme.color}
        disabled={loading}
        style={{ margin: '2px' }}
        onChange={(event) => onFilterTextChange(event.target.value)}
      />

      <div
        className={styles.objectList}
        style={
          {
            borderColor: modalTheme.borderColor,
            color: modalTheme.color,
            '--database-compare-accent-color': modalTheme.saveButtonBackgroundColor,
            '--database-compare-border-color': modalTheme.borderColor,
            '--database-compare-row-background-color': modalTheme.fieldBackgroundColor,
          } as React.CSSProperties
        }
      >
        {!groups.length && (
          <Text small color={modalTheme.color} userSelect={false}>
            {t('databaseCompare.noObjects')}
          </Text>
        )}

        {!!listItems.length && (
          <VirtualizeList
            height="100%"
            itemCount={listItems.length}
            itemSize={(index) => (listItems[index]?.type === 'schema' ? 30 : 33)}
          >
            {({ index }) => {
              const item = listItems[index];

              if (!item) return null;

              if (item.type === 'schema') {
                return (
                  <div className={styles.schemaHeader}>
                    <button
                      className={styles.schemaButton}
                      type="button"
                      disabled={loading}
                      onClick={() => onToggleSchemaVisibility(item.groupKey)}
                    >
                      <span className={styles.schemaLabel}>{getSchemaLabel(item.label)}</span>
                      <span className={styles.schemaDivider} />
                      <small>
                        {item.selectedCount}/{item.objects.length}
                      </small>
                    </button>
                    <input
                      type="checkbox"
                      checked={item.allSelected}
                      disabled={loading}
                      onChange={() => {
                        onToggleGroup(item.objects);
                      }}
                    />
                  </div>
                );
              }

              const objectKey = getObjectKey(item.object);
              const isSelected = selectedObjectSet.has(objectKey);

              return (
                <label className={`${styles.tableButton} ${isSelected ? styles.selected : ''}`}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={loading}
                    onChange={() => onToggleObject(item.object)}
                  />
                  <span>{getObjectDisplayName(item.object)}</span>
                  <small>{getObjectTypeLabel(item.object)}</small>
                </label>
              );
            }}
          </VirtualizeList>
        )}
      </div>

      <Divider />

      <Row>
        <Spacer />

        <Button
          color={modalTheme.saveButtonColor}
          backgroundColor={modalTheme.cancelButtonBackgroundColor}
          onClick={onClose}
          xs={6}
          sm={4}
          md={3}
        >
          {t('common.close')}
        </Button>
      </Row>
    </Modal>
  );
});

ObjectsModal.displayName = 'ObjectsModal';
