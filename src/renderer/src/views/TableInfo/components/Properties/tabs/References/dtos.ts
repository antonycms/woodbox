import type { IColumnReferenceInfo } from '@shared/types/database';

export type IReferenceRow = IColumnReferenceInfo & { source_table: string };
