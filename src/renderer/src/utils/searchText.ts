export function normalizeSearch(value: string) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizeCompactSearch(value: string) {
  return compactSearchText(normalizeSearch(value));
}

export function compactSearchText(normalized: string) {
  return normalized.replace(/[\s_.-]+/g, '');
}

export function prepareSearchText(value: string) {
  const normalized = normalizeSearch(value);
  return { normalized, compact: compactSearchText(normalized) };
}

export function matchesSearchText(
  candidate: ReturnType<typeof prepareSearchText>,
  filter: ReturnType<typeof prepareSearchText>,
) {
  return (
    candidate.normalized.includes(filter.normalized) ||
    (!!filter.compact && candidate.compact.includes(filter.compact))
  );
}
