/* eslint-disable @typescript-eslint/ban-types */
import { useState } from 'react';
import useDebounce from './useDebounce';

type ValueOrCallback<Type> = Type | (() => Type);

function useStateWithDebounce<Type = any>(valueOrCallback?: ValueOrCallback<Type>, delay?: number) {
  const [state, setState] = useState<Type>(valueOrCallback);
  const setStateWithDebounce = useDebounce<React.Dispatch<React.SetStateAction<Type>>>(
    setState,
    delay,
  );

  return [state, setStateWithDebounce] as const;
}

export default useStateWithDebounce;
