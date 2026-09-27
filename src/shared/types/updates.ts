export interface UpdateAvailablePayload {
  version: string;
  currentVersion: string;
  releaseName?: string | null;
  releaseNotes?: string | null;
  releaseDate?: string;
  manualDownloadUrl?: string;
}

export interface UpdateProgressPayload {
  version?: string;
  percent: number;
  transferred: number;
  total: number;
}
