import type { IButtonDropdownOption } from '@renderer/components/ButtonDropdown';
import type { IAIChatModelSelectionProps } from '../../types';

export interface IAIChatProps {
  id_chat: string;
  initialMessage?: string;
  modelSelection: IAIChatModelSelectionProps;
  onInitialMessageHandled?(): void;
  onNewChat?(): void;
  onClose?(): void;
  menuOptions?: IButtonDropdownOption[];
  onSelectMenuOption?(option: IButtonDropdownOption): void;
}

export interface IActiveMention {
  start: number;
  end: number;
  query: string;
}
