export interface IAIChatModelGroup {
  providerId: string;
  providerName: string;
  models: string[];
}

export interface IAIChatModelSelection {
  providerId?: string;
  model?: string;
}

export interface IAIChatModelSelectionProps {
  modelGroups: IAIChatModelGroup[];
  selectedProviderId?: string;
  selectedModel?: string;
  onModelChange(providerId: string, model: string): void;
}

export interface IAIChatConnectionOption {
  id: string;
  label: string;
  meta: string;
}

export interface IAIChatTableMentionOption {
  id: string;
  label: string;
  meta: string;
}
