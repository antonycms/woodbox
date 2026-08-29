import React from 'react';
import { Input } from '@renderer/components/Input';
import { useI18n } from '@renderer/contexts/I18n';
import call from '@renderer/utils/call';
import type { RegisterField, SetConnectionFormState } from '../../types';

interface IConnectionModeFileFieldsProps {
  register: RegisterField;
  setState: SetConnectionFormState;
  color: string;
  backgroundColor: string;
}

export const ConnectionModeFileFields = React.memo(
  ({ register, setState, color, backgroundColor }: IConnectionModeFileFieldsProps) => {
    const { t } = useI18n();

    const selectSqliteFile = React.useCallback(async () => {
      const filePath = await call<string | null>('@dialog:select_sqlite_file');

      if (!filePath) return;

      setState((prevState) => ({ ...prevState, database: filePath }));
    }, [setState]);

    return (
      <Input
        required
        label={t('field.file')}
        md={8}
        color={color}
        backgroundColor={backgroundColor}
        {...register('database')}
        readOnly
        onClick={selectSqliteFile}
      />
    );
  },
);

ConnectionModeFileFields.displayName = 'ConnectionModeFileFields';
