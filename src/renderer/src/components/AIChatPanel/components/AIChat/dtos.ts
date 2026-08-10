import type { IButtonDropdownOption } from '@renderer/components/ButtonDropdown';

export interface IAIChatProps {
  id_chat: string;
  initialMessage?: string;
  onConfigureProviders?(): void;
  onInitialMessageHandled?(): void;
  onNewChat?(): void;
  onClose?(): void;
  onToggleList?(): void;
  menuOptions?: IButtonDropdownOption[];
  onSelectMenuOption?(option: IButtonDropdownOption): void;
}

export interface IActiveMention {
  start: number;
  end: number;
  query: string;
}
