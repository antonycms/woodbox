import type { DatabaseObjectType } from '@renderer/contexts/Store/context';

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

export interface IAIChatReferenceOption {
  id: string;
  label: string;
  meta: string;
  idConnection: string;
  type: 'table' | 'function';
  schema?: string;
  table?: string;
  functionName?: string;
  objectType?: DatabaseObjectType;
  supportsIndexes?: boolean;
  supportsTriggers?: boolean;
}

export interface IAIChatDraftContext {
  id: string;
  title: string;
  content: string;
  language?: 'sql' | 'json';
}
