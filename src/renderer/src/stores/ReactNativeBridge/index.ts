import { create } from 'zustand';
import type { WoodboxApi } from '@shared/types/api';

export const useReactNativeBridgeStore = create<WoodboxApi['reactNativeBridge']>()(() => ({
  getStatus: (...args) => window.api.reactNativeBridge.getStatus(...args),
  getSessions: (...args) => window.api.reactNativeBridge.getSessions(...args),
  start: (...args) => window.api.reactNativeBridge.start(...args),
  stop: (...args) => window.api.reactNativeBridge.stop(...args),
  onEvent: (...args) => window.api.reactNativeBridge.onEvent(...args),
  onSessionConnected: (...args) => window.api.reactNativeBridge.onSessionConnected(...args),
  onSessionDisconnected: (...args) => window.api.reactNativeBridge.onSessionDisconnected(...args),
}));
