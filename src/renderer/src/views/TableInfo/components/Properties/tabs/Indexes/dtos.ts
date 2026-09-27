import type { IIndexInfo } from '@shared/types/database';

export type IIndexInfoSerialized = IIndexInfo & {
  column_names_display?: string;
  index_size?: string;
};
