export const toDateTime = (date: Date | string = new Date()) => {
  const localDate = new Date(date);

  return localDate.toLocaleString('pt-BR', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });
};
