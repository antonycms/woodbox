import React from 'react';
import { AutocompleteMulti } from '@renderer/components/AutocompleteMulti';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import Editor, { type IEditorRef } from '@renderer/components/Editor';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useI18n } from '@renderer/contexts/I18n';
import { useStoreContext, type ISnippet } from '@renderer/contexts/Store';
import { useThemeContext } from '@renderer/contexts/Theme';
import { ExportIcon } from '@renderer/styles/icons';
import { downloadSnippetFile, getSnippetBodyText, getSnippetScopes } from '@renderer/utils/snippets';
import styles from './styles.module.css';

const emptyForm = {
  name: '',
  prefix: '',
  description: '',
  scopes: [] as string[],
  body: '',
};

export const ModalSnippet = React.memo((props: IModalSnippetProps) => {
  const { show, snippet, onClose } = props;
  const { t } = useI18n();
  const { addSnippet, editSnippet, connectionTypes } = useStoreContext();
  const {
    activeTheme: { modal: colors },
  } = useThemeContext();

  const editorRef = React.useRef<IEditorRef>(null);
  const [form, setForm] = React.useState(emptyForm);

  const dialectOptions = React.useMemo(() => {
    return (connectionTypes?.length ? connectionTypes : ['postgres', 'mysql', 'sqlite']).map(
      (dialect) => ({ label: dialect, value: dialect }),
    );
  }, [connectionTypes]);

  const close = React.useCallback(() => {
    setForm(emptyForm);
    onClose?.();
  }, [onClose]);

  const updateField = React.useCallback((field: keyof typeof emptyForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const updateScopes = React.useCallback((value: (string | number)[]) => {
    setForm((prev) => ({ ...prev, scopes: value.map(String) }));
  }, []);

  const onSubmit = React.useCallback(
    async (event: React.SubmitEvent) => {
      event.preventDefault();

      const now = new Date().toISOString();
      const body = editorRef.current?.getValue() ?? form.body;
      const payload: Omit<ISnippet, 'id'> = {
        name: form.name.trim(),
        prefix: form.prefix.trim(),
        description: form.description.trim() || undefined,
        scope: form.scopes.join(',') || undefined,
        body: body.split('\n'),
        created_at: snippet?.created_at || now,
        updated_at: now,
      };

      if (!payload.name || !payload.prefix || !body.trim()) return;

      if (snippet) {
        await editSnippet(snippet.id, payload);
      } else {
        await addSnippet(payload);
      }

      close();
    },
    [addSnippet, close, editSnippet, form, snippet],
  );

  React.useEffect(() => {
    if (!show) return;

    if (!snippet) return setForm(emptyForm);

    setForm({
      name: snippet.name,
      prefix: Array.isArray(snippet.prefix) ? snippet.prefix.join(', ') : snippet.prefix,
      description: snippet.description || '',
      scopes: getSnippetScopes(snippet.scope),
      body: getSnippetBodyText(snippet.body),
    });
  }, [show, snippet]);

  return (
    <Modal
      title={snippet ? t('snippet.edit') : t('snippet.new')}
      width="720px"
      show={show}
      closeOutside
      onClose={close}
    >
      <form onSubmit={onSubmit}>
        <Row>
          <Input
            autoFocus
            required
            md={6}
            label={t('field.name')}
            value={form.name}
            onChange={(event) => updateField('name', event.target.value)}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            labelColor={colors.fieldLabelColor}
          />

          <Input
            required
            md={6}
            label={t('field.snippetPrefix')}
            value={form.prefix}
            onChange={(event) => updateField('prefix', event.target.value)}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            labelColor={colors.fieldLabelColor}
          />

          <Input
            md={12}
            label={t('field.description')}
            value={form.description}
            onChange={(event) => updateField('description', event.target.value)}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            labelColor={colors.fieldLabelColor}
          />

          <AutocompleteMulti
            md={12}
            label={t('field.dialects')}
            value={form.scopes}
            data={dialectOptions}
            placeholder={t('snippet.globalAll')}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            labelColor={colors.fieldLabelColor}
            onChange={({ value }) => updateScopes(value)}
          />
        </Row>

        <Divider size={6} />

        <Text userSelect={false} small color={colors.fieldLabelColor}>
          {t('snippet.bodyHelp')}
        </Text>

        <div className={styles.editorContainer}>
          <Editor
            ref={editorRef}
            hidePreview
            value={form.body}
            onChange={(value) => updateField('body', value)}
          />
        </div>

        <Divider size={8} />

        <Row>
          {!!snippet && (
            <Button
              xs={6}
              sm={4}
              md={3}
              icon={() => <ExportIcon size={14} />}
              onClick={() => downloadSnippetFile(snippet)}
              color={colors.testButtonColor}
              backgroundColor={colors.testButtonBackgroundColor}
            >
              {t('common.export')}
            </Button>
          )}

          <Spacer />

          <Button
            xs={6}
            sm={4}
            md={3}
            onClick={close}
            color={colors.cancelButtonColor}
            backgroundColor={colors.cancelButtonBackgroundColor}
          >
            {t('common.cancel')}
          </Button>

          <Button
            xs={6}
            sm={4}
            md={3}
            type="submit"
            color={colors.saveButtonColor}
            backgroundColor={colors.saveButtonBackgroundColor}
          >
            {t('common.save')}
          </Button>
        </Row>
      </form>
    </Modal>
  );
});

ModalSnippet.displayName = 'ModalSnippet';

interface IModalSnippetProps {
  show?: boolean;
  snippet?: ISnippet;
  onClose?(): void;
}
