export const quoteSqlIdentifier = (value: string) => `"${String(value).replace(/"/g, '""')}"`;

export const quoteMysqlIdentifier = (value: string) => `\`${String(value).replace(/`/g, '``')}\``;
