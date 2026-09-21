import type { ITriggerInfo } from '@shared/types/database';

export const getTriggerSearchValues = (trigger: ITriggerInfo) => [
  trigger.trigger_name,
  trigger.timing,
  trigger.event,
  trigger.orientation,
  trigger.function_name,
  trigger.status,
];

export const getTriggerSelectionKey = (trigger: ITriggerInfo) => trigger.trigger_name;

export const getTriggerRowKey = (item: ITriggerInfo) => item.trigger_name;
