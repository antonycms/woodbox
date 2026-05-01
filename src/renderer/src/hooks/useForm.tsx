import { setObjectProperty } from '@renderer/utils/object';
import { useCallback, useRef, useState } from 'react';

export function useForm<Data = unknown>(initialValue = {} as Data) {
  const [state, setState] = useState<Data>(initialValue);
  const valueRef = useRef(state);

  valueRef.current = state;

  const reset = useCallback(() => setState(initialValue), []);

  const getValue = useCallback(() => valueRef.current, []);

  const onChange = useCallback((event: any) => {
    const { type, name, value, checked } = event?.target || event || {};

    if (!name) {
      throw new Error('Error on change event in [useForm], "name" is required.');
    }

    const v = type === 'checkbox' ? !!checked : value ?? null;

    setState((prevState) => setObjectProperty(prevState as any, name, v, true));
  }, []);

  const register = <U extends keyof Data>(name: U) => {
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
