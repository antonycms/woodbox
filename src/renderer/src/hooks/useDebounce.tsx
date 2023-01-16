/* eslint-disable @typescript-eslint/ban-types */
import { useRef, useCallback } from 'react';

function useDebounce<Type = any>(fn: Function, delay?: number): Type {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debounceFn = useCallback(
    (...args) => {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => fn(...args), delay);
    },
    [fn, delay],
  );

  return debounceFn as any;
}

export default useDebounce;
