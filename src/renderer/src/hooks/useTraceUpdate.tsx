import { useEffect, useRef } from 'react';

export const useTraceUpdate = (props: object, name?: string) => {
  const prev = useRef(props);

  useEffect(() => {
    if (typeof props !== 'object') return;

    const changedProps = Object.entries(props).reduce((ps, [k, v]) => {
      if (prev.current[k] !== v) {
        ps[k] = [prev.current[k], v];
      }

      return ps;
    }, {});

    if (Object.keys(changedProps).length > 0) {
      console.log(`${name ? `[${name}] ` : ''}Changed props:`, changedProps);
    }

    prev.current = props;
  });
};
