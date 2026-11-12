import type { IInputProps } from '@renderer/components/Input';
import type { IConnectionTestInput } from '@shared/types/connections';
import type React from 'react';

export type RegisteredField<Name extends keyof IConnectionTestInput> = Pick<
  IInputProps,
  'onChange'
> & {
  name: Name;
  value: IConnectionTestInput[Name];
};

export type RegisterField = <Name extends keyof IConnectionTestInput>(
  name: Name,
) => RegisteredField<Name>;

export type SetConnectionFormState = React.Dispatch<React.SetStateAction<IConnectionTestInput>>;
