import type { Dialect } from './connections';
import type { IColumnInfo } from './database';

export interface ColumnGridData { rows: IColumnInfo[]; }
export interface ColumnAutoIncrementRequest { policyId: Dialect; dataTypes: string[]; }
