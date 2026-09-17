import type { IColumnReferenceInfo } from '@renderer/contexts/Store';

export type IReferenceRow = IColumnReferenceInfo & { source_table: string };
