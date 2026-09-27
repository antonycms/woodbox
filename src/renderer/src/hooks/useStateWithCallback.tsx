import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';

export default function useStateWithCallback<T>(initState: T) {
  const callbackRef = useRef<((state: T) => void) | undefined>(undefined);
  const [state, setState] = useState(initState);

  const setCallbackState = useCallback((value: SetStateAction<T>, callback?: (state: T) => void) => {
    callbackRef.current = callback;
    setState(value);
  }, []);

  useEffect(() => {
    const callback = callbackRef.current;
    callbackRef.current = undefined;
    callback?.(state);
  }, [state]);

  return [state, setCallbackState] as const;
}
