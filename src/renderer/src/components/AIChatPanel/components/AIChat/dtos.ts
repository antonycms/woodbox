import type { IAIChatImage } from '@shared/types/ai';
import type { IButtonDropdownOption } from '@renderer/components/ButtonDropdown';
import type {
  IAIChatConnectionOption,
  IAIChatDraftContext,
  IAIChatModelSelectionProps,
  IAIChatReferenceOption,
} from '../../types';

export interface IAIChatProps {
  id_chat: string;
  initialMessage?: string;
  initialImage?: IAIChatImage;
  draftContexts?: IAIChatDraftContext[];
  connectionOptions: IAIChatConnectionOption[];
  referenceOptions: IAIChatReferenceOption[];
  modelSelection: IAIChatModelSelectionProps;
  selectedConnectionId?: string;
  onConnectionChange(connectionId: string): void;
  onConfigureProviders?(): void;
  onClearDraftContexts?(): void;
  onOpenReference?(option: IAIChatReferenceOption): void;
  onRemoveDraftContext?(contextId: string): void;
  onInitialMessageHandled?(): void;
  onNewChat?(): void;
  onClose?(): void;
  menuOptions?: IButtonDropdownOption[];
  onSelectMenuOption?(option: IButtonDropdownOption): void;
}
