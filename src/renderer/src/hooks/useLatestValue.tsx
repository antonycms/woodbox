import { useEffect, useRef } from 'react';

export function useLatestValue<Value = unknown>(
  getNewValue: (currentValue: Value) => Value,
  checkFunction: (currentValue: Value) => boolean,
) {
  const ref = useRef(getNewValue(undefined));

  const check = checkFunction?.(ref.current);

  if (check) {
    ref.current = getNewValue(ref.current);
  }

  return ref.current;
}
