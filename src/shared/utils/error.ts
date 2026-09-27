export const getErrorMessage = (error: unknown, fallback = ''): string => {
  if (typeof error === 'string') return error || fallback;
  if (
    error && typeof error === 'object' && 'message' in error &&
    typeof error.message === 'string'
  ) return error.message || fallback;
  return fallback;
};
