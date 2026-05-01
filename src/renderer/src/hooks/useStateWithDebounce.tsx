/* eslint-disable @typescript-eslint/ban-types */
import { useState } from 'react';
import useDebounce from './useDebounce';

function useStateWithDebounce<Type = any>(initialValue: Type, delay?: number) {
  const [state, setState] = useState<Type>(initialValue);

  const setDebounce = useDebounce<React.Dispatch<React.SetStateAction<Type>>>(setState, delay);

  return [state, setDebounce] as const;
}

export default useStateWithDebounce;
