import type { IButtonDropdownOption } from '@renderer/components/ButtonDropdown';
import type { IAIChatConnectionOption, IAIChatModelSelectionProps } from '../../types';

export interface IAIChatProps {
  id_chat: string;
  initialMessage?: string;
  connectionOptions: IAIChatConnectionOption[];
  modelSelection: IAIChatModelSelectionProps;
  selectedConnectionId?: string;
  onConnectionChange(connectionId: string): void;
  onInitialMessageHandled?(): void;
  onNewChat?(): void;
  onClose?(): void;
  menuOptions?: IButtonDropdownOption[];
  onSelectMenuOption?(option: IButtonDropdownOption): void;
}
