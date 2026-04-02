import { useCallback, useRef, useState } from 'react';
import { makeOnChangeSetState } from '../utils/methods';

export function useForm<Data = unknown>(initialValue = {} as Data) {
  const [state, setState] = useState<Data>(initialValue);
  const valueRef = useRef(state);

  valueRef.current = state;

  const reset = useCallback(() => setState(initialValue), []);

  const onChange = useCallback(makeOnChangeSetState(setState), []);

  const getValue = useCallback(() => valueRef.current, []);

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
