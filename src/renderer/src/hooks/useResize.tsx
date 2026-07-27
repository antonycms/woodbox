import { useCallback, useEffect, useRef } from 'react';
import useStateWithDebounce from './useStateWithDebounce';

interface IUseResize {
  idHTMLElement?: string;
  HTMLElement?: HTMLElement;
  ignoreZeroValue?: boolean;
}

const useResize = (options: IUseResize = {}) => {
  const { ignoreZeroValue } = options;
  const [elementWidth, setElementWidth] = useStateWithDebounce(0);
  const [elementHeight, setElementHeight] = useStateWithDebounce(0);
  const sizeRef = useRef({ width: 0, height: 0 });

  const setSize = useCallback(
    (width: number, height: number) => {
      if (((ignoreZeroValue && width) || !ignoreZeroValue) && width !== sizeRef.current.width) {
        sizeRef.current.width = width;
        setElementWidth(width);
      }

      if (((ignoreZeroValue && height) || !ignoreZeroValue) && height !== sizeRef.current.height) {
        sizeRef.current.height = height;
        setElementHeight(height);
      }
    },
    [ignoreZeroValue, setElementHeight, setElementWidth],
  );

  useEffect(() => {
    const properties = Object.getOwnPropertyNames(options);

    let element: HTMLElement = options?.HTMLElement;

    if (properties.includes('HTMLElement') && !element) return;

    if (!element && options?.idHTMLElement) {
      element = document.getElementById(options?.idHTMLElement);
    }

    if (element) {
      const observer = new ResizeObserver(() => {
        setSize(element.clientWidth, element.clientHeight);
      });

      observer.observe(element);

      return () => observer?.disconnect?.();
    }

    setSize(window.innerWidth, window.innerHeight);

    const handle = () => {
      setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('resize', handle);

    return () => window.removeEventListener('resize', handle);
  }, [options?.HTMLElement, options?.idHTMLElement, setSize]);

  return { height: elementHeight, width: elementWidth };
};

export default useResize;
