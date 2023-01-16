import { useCallback, useState } from 'react';
import { makeOnChangeSetState } from '../utils/methods';

export function useForm<Data = unknown>(initialValue = {} as Data) {
  const [state, setState] = useState<Data>(initialValue);

  const onChange = useCallback(makeOnChangeSetState(setState), []);

  const register = useCallback(
    function <U extends keyof Data>(name: U) {
      return {
        name,
        onChange,
        value: state[name],
      };
    },
    [onChange, state],
  );

  const handleSubmit = (onSubmit: OnSubmit<Data>) => {
    return (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      onSubmit(state);
    };
  };

  const reset = useCallback(() => setState(initialValue), []);

  return { state, reset, setState, register, handleSubmit };
}

export type OnSubmit<Data = unknown> = (data: Data) => void;
