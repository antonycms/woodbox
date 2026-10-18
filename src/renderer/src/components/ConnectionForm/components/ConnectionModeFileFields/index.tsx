import { useShallow } from 'zustand/react/shallow';
import { useDialogsStore } from '@renderer/stores/Dialogs';
import React from 'react';
import { Input } from '@renderer/components/Input';
import { useI18nStore } from '@renderer/stores/I18n';
import type { RegisterField, SetConnectionFormState } from '../../types';

interface IConnectionModeFileFieldsProps {
  register: RegisterField;
  setState: SetConnectionFormState;
  color: string;
  backgroundColor: string;
}

export const ConnectionModeFileFields = React.memo(
  ({ register, setState, color, backgroundColor }: IConnectionModeFileFieldsProps) => {
    const dialogs = useDialogsStore(
      useShallow((state) => ({
        selectSqliteFile: state.selectSqliteFile,
      })),
    );
    const t = useI18nStore((state) => state.t);

    const selectSqliteFile = React.useCallback(async () => {
      const filePath = await dialogs.selectSqliteFile();

      if (!filePath) return;

      setState((prevState) => ({ ...prevState, database: filePath }));
    }, [dialogs, setState]);

    return (
      <Input
        required
        label={t('field.file')}
        md={7}
        xs={12}
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
