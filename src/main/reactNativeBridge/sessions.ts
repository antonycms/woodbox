import { randomUUID } from 'crypto';
import { emitEvent } from '@main/utils/emitEvent';
import type {
  BridgeHelloMessage,
  ReactNativeBridgeSessionInfo,
} from './protocol';

export interface ReactNativeBridgeSession extends ReactNativeBridgeSessionInfo {
  send(data: unknown): void;
}

const sessions = new Map<string, ReactNativeBridgeSession>();

export const createSessionId = () => randomUUID();

export const getReactNativeBridgeSessions = () => {
  return [...sessions.values()].map(({ send: _send, ...session }) => session);
};

export const getReactNativeBridgeSession = (sessionId: string) => {
  return sessions.get(sessionId);
};

export const findReactNativeBridgeSession = ({
  appId,
  adapterId,
}: {
  appId?: string;
  adapterId: string;
}) => {
  const matchingSessions = [...sessions.values()].filter((session) => {
    const hasAdapter = session.adapters.some((adapter) => adapter.id === adapterId);

    return hasAdapter && (!appId || session.appId === appId);
  });

  if (matchingSessions.length > 1 && !appId) {
    throw new Error('Mais de um app React Native compatível está conectado.');
  }

  return matchingSessions[0];
};

export const registerReactNativeBridgeSession = (
  id: string,
  hello: BridgeHelloMessage,
  send: (data: unknown) => void,
) => {
  const now = new Date().toISOString();
  const session: ReactNativeBridgeSession = {
    id,
    appId: hello.app.id,
    appName: hello.app.name,
    platform: hello.app.platform,
    deviceName: hello.app.deviceName,
    connectedAt: now,
    lastSeenAt: now,
    adapters: hello.adapters,
    send,
  };

  sessions.set(id, session);
  emitEvent('@event:react_native_bridge_session_connected', getReactNativeBridgeSessions());

  return session;
};

export const removeReactNativeBridgeSession = (id: string) => {
  const removed = sessions.delete(id);

  if (removed) {
    emitEvent('@event:react_native_bridge_session_disconnected', getReactNativeBridgeSessions());
  }
};

export const touchReactNativeBridgeSession = (id: string) => {
  const session = sessions.get(id);

  if (!session) return;

  session.lastSeenAt = new Date().toISOString();
};
