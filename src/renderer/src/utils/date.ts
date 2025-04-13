export const toDateTime = (date: Date | string = new Date()) => {
  const localDate = new Date(date);

  return localDate.toLocaleString(navigator.language, {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
};
