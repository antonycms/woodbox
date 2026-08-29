import type {
  BridgeResponseMessage,
  ExecuteSqlParams,
  SqliteExecutionResult,
} from './protocol';
import type { ReactNativeBridgeSession } from './sessions';

const pendingRequests = new Map<
  string,
  {
    resolve(result: unknown): void;
    reject(error: Error): void;
    timeout: NodeJS.Timeout;
  }
>();

export const requestReactNativeBridge = async (
  session: ReactNativeBridgeSession,
  adapterId: string,
  method: 'relational.executeSql',
  params?: ExecuteSqlParams,
  timeoutMs = 30000,
) => {
  const id = `${session.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  return new Promise<SqliteExecutionResult>((resolve, reject) => {
    const timeout = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error('A bridge React Native demorou demais para responder.'));
    }, timeoutMs);

    pendingRequests.set(id, {
      resolve,
      reject,
      timeout,
    });

    session.send({ type: 'request', id, adapterId, method, params });
  });
};

export const resolveReactNativeBridgeResponse = (message: BridgeResponseMessage) => {
  const pending = pendingRequests.get(message.id);

  if (!pending) return;

  clearTimeout(pending.timeout);
  pendingRequests.delete(message.id);

  if (message.ok) {
    pending.resolve(message.result);
    return;
  }

  pending.reject(new Error(message.error.message));
};

export const rejectReactNativeBridgeSessionRequests = (sessionId: string) => {
  for (const [id, pending] of pendingRequests) {
    if (!id.startsWith(sessionId)) continue;

    clearTimeout(pending.timeout);
    pendingRequests.delete(id);
    pending.reject(new Error('A conexão com o app React Native foi encerrada.'));
  }
};
