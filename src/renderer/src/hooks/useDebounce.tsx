import { useRef, useCallback } from 'react';

type DebouncedFunction = (...args: unknown[]) => unknown;

function useDebounce<Fn extends DebouncedFunction>(fn: Fn, delay?: number): Fn {
  const debounceRef = useRef<{
    fn: Fn;
    delay?: number;
    timeout: ReturnType<typeof setTimeout> | null;
  }>({
    fn,
    delay,
    timeout: null,
  });

  debounceRef.current.fn = fn;
  debounceRef.current.delay = delay;

  const debounceFn = useCallback((...args: Parameters<Fn>) => {
    if (debounceRef.current.timeout) {
      clearTimeout(debounceRef.current.timeout);
    }

    debounceRef.current.timeout = setTimeout(() => {
      debounceRef.current.fn?.(...args);
    }, debounceRef.current.delay);
  }, []);

  return debounceFn as Fn;
}

export default useDebounce;
