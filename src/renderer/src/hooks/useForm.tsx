import { setObjectProperty } from '@renderer/utils/object';
import { useCallback, useRef, useState } from 'react';

export interface FormChangeValue {
  type?: string;
  name?: string;
  value?: unknown;
  checked?: boolean;
}

export type FormChangeEvent = FormChangeValue | { target: FormChangeValue };

export function useForm<Data extends object = Record<string, unknown>>(initialValue = {} as Data) {
  const [state, setState] = useState<Data>(initialValue);
  const valueRef = useRef(state);

  valueRef.current = state;

  const reset = useCallback(() => setState(initialValue), []);

  const getValue = useCallback(() => valueRef.current, []);

  const onChange = useCallback((event: FormChangeEvent) => {
    const { type, name, value, checked } = 'target' in event ? event.target : event;

    if (!name) {
      throw new Error('Error on change event in [useForm], "name" is required.');
    }

    const v = type === 'checkbox' ? !!checked : (value ?? null);

    setState((prevState) => setObjectProperty(prevState, name, v, true));
  }, []);

  const register = <U extends Extract<keyof Data, string>>(name: U) => {
    return {
      name,
      onChange,
      value: state[name],
    };
  };

  const handleSubmit = (onSubmit: OnSubmit<Data>) => {
    return (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSubmit(valueRef.current);
    };
  };

  return { state, reset, setState, register, handleSubmit, getValue };
}

export type OnSubmit<Data = unknown> = (data: Data) => void;
