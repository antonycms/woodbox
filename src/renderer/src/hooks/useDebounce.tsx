/* eslint-disable @typescript-eslint/ban-types */
import { useRef, useCallback } from 'react';

function useDebounce<Type = any>(fn: Function, delay?: number): Type {
  const debounceRef = useRef({ fn, delay, timeout: null as NodeJS.Timeout });

  debounceRef.current.fn = fn;
  debounceRef.current.delay = delay;

  const debounceFn = useCallback((...args) => {
    clearTimeout(debounceRef.current.timeout);

    debounceRef.current.timeout = setTimeout(() => {
      debounceRef.current.fn?.(...args);
    }, debounceRef.current.delay);
  }, []);

  return debounceFn as any;
}

export default useDebounce;
