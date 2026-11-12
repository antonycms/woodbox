// Resolve selection captured before an async column gesture against its latest rows.
// Separate namespaces avoid a new pending ID colliding with an existing object name.
export const resolvePropertySelection = <Row extends object>(
  selected: Row[], existing: Row[], pending: Row[], key: (row: Row) => string,
): Row[] => {
  const first = (rows: Row[], getKey: (row: Row) => string) => {
    const index = new Map<string, Row>();
    for (const row of rows) {
      const id = getKey(row);
      if (!index.has(id)) index.set(id, row);
    }
    return index;
  };
  const pendingId = (row: Row) => '__pendingId' in row && typeof row.__pendingId === 'string' ? row.__pendingId : undefined;
  const loaded = first(existing, key);
  const created = first(pending, (row) => pendingId(row));
  const rows: Row[] = [];
  for (const row of selected) {
    const id = pendingId(row);
    const latest = id ? created.get(id) : loaded.get(key(row));
    if (latest) rows.push(latest);
  }
  return rows;
};
