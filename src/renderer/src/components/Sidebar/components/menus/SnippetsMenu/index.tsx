import React from 'react';
import { Button } from '@renderer/components/Button';
import { Card } from '@renderer/components/Card';
import { Chip } from '@renderer/components/Chip';
import { Divider } from '@renderer/components/Divider';
import { Row } from '@renderer/components/Grid';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useI18n } from '@renderer/contexts/I18n';
import { useStoreContext, type ISnippet } from '@renderer/contexts/Store';
import { useToast } from '@renderer/contexts/Toast';
import { useThemeContext } from '@renderer/contexts/Theme';
import { AddIcon, ImportIcon, RemoveIcon } from '@renderer/styles/icons';
import {
  getSnippetPrefixes,
  getSnippetScopes,
  parseSnippetsFileContent,
} from '@renderer/utils/snippets';
import { ModalSnippet } from './components/ModalSnippet';
import WholeWordIcon from '@renderer/assets/icons/whole-word.svg?react';
import styles from './styles.module.css';

const readFileText = (file: File) => {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
};

const SnippetsMenu = () => {
  const { t } = useI18n();
  const { snippets, addSnippet, removeSnippet } = useStoreContext();
  const { showToast } = useToast();
  const {
    activeTheme: { __colors, sideBar: colors },
  } = useThemeContext();

  const inputFileRef = React.useRef<HTMLInputElement>(null);
  const [filterText, setFilterText] = React.useState('');
  const [isWholeWordFilter, setIsWholeWordFilter] = React.useState(false);
  const [editingSnippet, setEditingSnippet] = React.useState<ISnippet>();
  const [showNewSnippet, setShowNewSnippet] = React.useState(false);
  const [snippetToRemove, setSnippetToRemove] = React.useState<ISnippet>();

  const normalizedFilterText = filterText.trim().toLowerCase();

  const checkFilterText = React.useCallback(
    (value?: string) => {
      const normalizedValue = value?.trim().toLowerCase();

      if (!normalizedValue) return false;

      return isWholeWordFilter
        ? normalizedValue === normalizedFilterText
        : normalizedValue.includes(normalizedFilterText);
    },
    [isWholeWordFilter, normalizedFilterText],
  );

  const filteredSnippets = React.useMemo(() => {
    return snippets
      .filter((snippet) => {
        if (!normalizedFilterText) return true;

        return [snippet.name, snippet.description, getSnippetPrefixes(snippet.prefix).join(',')]
          .filter(Boolean)
          .some(checkFilterText);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [checkFilterText, normalizedFilterText, snippets]);

  const openNewSnippet = React.useCallback(() => {
    setShowNewSnippet(true);
  }, []);

  const closeSnippetModal = React.useCallback(() => {
    setShowNewSnippet(false);
    setEditingSnippet(undefined);
  }, []);

  const handleImport = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';

      if (!file) return;

      try {
        const content = await readFileText(file);
        const importedSnippets = parseSnippetsFileContent(content);
        const now = new Date().toISOString();

        await Promise.all(
          importedSnippets.map((snippet) =>
            addSnippet({ ...snippet, created_at: now, updated_at: now }),
          ),
        );

        showToast({
          type: 'success',
          title: t('snippet.imported'),
          description: t('snippet.importedDescription', { count: importedSnippets.length }),
        });
      } catch (_error) {
        showToast({
          type: 'error',
          title: t('snippet.importFailed'),
          description: t('snippet.invalidImportFile'),
        });
      }
    },
    [addSnippet, showToast, t],
  );

  const confirmRemoveSnippet = React.useCallback(async () => {
    if (!snippetToRemove) return;

    await removeSnippet(snippetToRemove.id);
    setSnippetToRemove(undefined);
  }, [removeSnippet, snippetToRemove]);

  const toggleWholeWordFilter = React.useCallback(() => {
    setIsWholeWordFilter((prevState) => !prevState);
  }, []);

  const handleSnippetCardKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>, snippet: ISnippet) => {
      if (event.key !== 'Enter') return;

      setEditingSnippet(snippet);
    },
    [],
  );

  return (
    <>
      <ModalSnippet
        show={showNewSnippet || !!editingSnippet}
        snippet={editingSnippet}
        onClose={closeSnippetModal}
      />

      <Modal
        title={t('snippet.delete')}
        width="420px"
        show={!!snippetToRemove}
        closeOutside
        onClose={() => setSnippetToRemove(undefined)}
      >
        <Text small color={colors.color}>
          {t('snippet.deleteQuestion', { name: snippetToRemove?.name || '' })}
        </Text>

        <Divider size={14} />

        <Row>
          <Button
            xs={12}
            sm={6}
            onClick={() => setSnippetToRemove(undefined)}
            color={__colors.white}
            backgroundColor={__colors.gray}
          >
            {t('common.cancel')}
          </Button>

          <Button
            xs={12}
            sm={6}
            onClick={confirmRemoveSnippet}
            color={__colors.white}
            backgroundColor={__colors.red}
          >
            {t('common.delete')}
          </Button>
        </Row>
      </Modal>

      <Row>
        <Text bold color={colors.color} userSelect={false}>
          {t('sidebar.snippets')}
        </Text>

        <Spacer />

        <Button
          smallIcon
          text
          title={t('snippet.import')}
          color={colors.color}
          icon={() => <ImportIcon size={14} />}
          onClick={() => inputFileRef.current?.click()}
        />

        <Button
          smallIcon
          text
          title={t('snippet.add')}
          color={colors.color}
          icon={() => <AddIcon size={12} />}
          onClick={openNewSnippet}
        />

        <input
          ref={inputFileRef}
          type="file"
          accept="application/json,.json,.code-snippets"
          className={styles.hiddenInput}
          onChange={handleImport}
        />
      </Row>

      <Divider />

      <Input
        placeholder={t('common.filter')}
        value={filterText}
        onChange={(event) => setFilterText(event.target.value)}
        color={colors.fieldColor}
        backgroundColor={colors.fieldBackgroundColor}
        placeholderColor={colors.fieldPlaceholderColor}
        icon={() => (
          <Button
            smallIcon
            text
            title={t('common.exactWord')}
            icon={() => <WholeWordIcon />}
            color={isWholeWordFilter ? 'white' : 'gray'}
            onClick={toggleWholeWordFilter}
          />
        )}
      />

      <Divider />

      <div className={styles.list}>
        {!filteredSnippets.length && (
          <Text userSelect={false} small color={colors.color}>
            {t('snippet.empty')}
          </Text>
        )}

        {filteredSnippets.map((snippet) => {
          const prefixes = getSnippetPrefixes(snippet.prefix);
          const scopes = getSnippetScopes(snippet.scope);

          return (
            <Card
              key={snippet.id}
              role="button"
              tabIndex={0}
              className={styles.card}
              onClick={() => setEditingSnippet(snippet)}
              onKeyDown={(event) => handleSnippetCardKeyDown(event, snippet)}
              color={colors.color}
              borderColor={__colors.lightGray}
              backgroundColor={colors.cardBackgroundColor || colors.fieldBackgroundColor}
            >
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>
                  <strong>{snippet.name}</strong>
                  <span>{prefixes.join(', ')}</span>
                </div>

                <Button
                  smallIcon
                  text
                  title={t('common.delete')}
                  color={colors.color}
                  icon={() => <RemoveIcon size={13} />}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSnippetToRemove(snippet);
                  }}
                />
              </div>

              {!!snippet.description && <p className={styles.description}>{snippet.description}</p>}

              <div className={styles.dialects}>
                {(scopes.length ? scopes : [t('snippet.global')]).map((dialect) => (
                  <Chip
                    key={dialect}
                    title={dialect}
                    color={colors.color}
                    borderColor={__colors.lightGray}
                    backgroundColor={__colors.darkLightBar}
                  >
                    {dialect}
                  </Chip>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
};

export default React.memo(SnippetsMenu);
