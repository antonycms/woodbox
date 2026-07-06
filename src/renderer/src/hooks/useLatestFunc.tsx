import { useRef, useEffect, useCallback } from 'react';

type Maybe<T> = T | undefined | null;
type LatestFunction = (...args: unknown[]) => unknown;

// https://reactjs.org/docs/hooks-faq.html#what-can-i-do-if-my-effect-dependencies-change-too-often
export function useLatestFunc<T extends Maybe<LatestFunction>>(fn: T): T {
  const ref = useRef(fn);

  useEffect(() => {
    ref.current = fn;
  });

  const callbackFn = useCallback((...args: Parameters<NonNullable<T>>) => {
    return ref.current?.(...args);
  }, []) as NonNullable<T>;

  return (fn ? callbackFn : fn) as T;
}
