import type { IProcessListCapturedRow } from './utils/capture';

export interface IProcessListCaptureState {
  active: boolean;
  started_at: string;
  stopped_at?: string;
  rows: IProcessListCapturedRow[];
  rowHashes: string[];
}
