type EventCallback<T> = (data: T) => void;
type CancelListener = () => void;

export const appEventOn = <Data = unknown>(
  name: string,
  eventCallback: EventCallback<Data>,
): CancelListener => {
  const callback = (e: CustomEvent) => eventCallback(e.detail);

  document.addEventListener(name, callback);

  return () => document.removeEventListener(name, callback);
};

export const appEventEmit = <Data = unknown>(name: string, data?: Data): void => {
  const event = new CustomEvent(name, { detail: data });
  document.dispatchEvent(event);
};
