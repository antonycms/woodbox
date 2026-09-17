import type { IIndexInfo } from '@renderer/contexts/Store';

export type IIndexInfoSerialized = IIndexInfo & {
  column_names_display?: string;
  index_size?: string;
};
