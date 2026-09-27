export const defaultExtractLabel = (item: unknown): string =>
  typeof item === 'string' ? item : (item as { label?: string })?.label;

export const defaultExtractValue = (item: unknown): string | number =>
  typeof item === 'string' ? item : (item as { value?: string | number })?.value;
