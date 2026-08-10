import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { createInterface } from 'readline';

type JsonRpcResponse = {
  id: number;
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
};

type JsonRpcNotification = {
  method: string;
  params?: unknown;
};

type PendingRequest = {
  resolve(value: unknown): void;
  reject(error: Error): void;
  timeout: NodeJS.Timeout;
};

const DEFAULT_TIMEOUT_MS = 120_000;

class CodexRpcClient {
  private process?: ChildProcessWithoutNullStreams;
  private nextId = 1;
  private initialized?: Promise<void>;
  private pendingRequests = new Map<number, PendingRequest>();
  private notificationListeners = new Map<string, Set<(params: unknown) => void>>();

  async request<Result = unknown>(
    method: string,
    params?: unknown,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<Result> {
    await this.ensureInitialized();

    return this.send<Result>(method, params, timeoutMs);
  }

  onNotification(method: string, callback: (params: unknown) => void) {
    const listeners = this.notificationListeners.get(method) || new Set();

    listeners.add(callback);
    this.notificationListeners.set(method, listeners);

    return () => listeners.delete(callback);
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      this.initialized = this.start().then(() =>
        this.send('initialize', {
          clientInfo: {
            name: 'Woodbox',
            version: '1.0.0',
          },
          capabilities: {
            experimentalApi: true,
            requestAttestation: false,
          },
        }),
      ).then(() => undefined);
    }

    return this.initialized;
  }

  private async start() {
    this.process = spawn(process.env.CODEX_PATH || 'codex', ['app-server', '--stdio'], {
      stdio: 'pipe',
    });

    this.process.on('error', (error) => {
      this.rejectAll(
        new Error(
          `Não foi possível iniciar o Codex App Server. Verifique se o Codex CLI está instalado. ${error.message}`,
        ),
      );
      this.initialized = undefined;
    });

    this.process.on('exit', () => {
      this.rejectAll(new Error('Codex App Server foi encerrado.'));
      this.process = undefined;
      this.initialized = undefined;
    });

    const stdout = createInterface({ input: this.process.stdout });

    stdout.on('line', (line) => this.handleLine(line));
    this.process.stderr.on('data', () => {});
  }

  private send<Result = unknown>(method: string, params?: unknown, timeoutMs = DEFAULT_TIMEOUT_MS) {
    if (!this.process?.stdin.writable) {
      throw new Error('Codex App Server não está disponível.');
    }

    const id = this.nextId++;
    const payload = JSON.stringify({ id, method, params });

    return new Promise<Result>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Tempo esgotado ao chamar ${method}.`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (value) => resolve(value as Result),
        reject,
        timeout,
      });

      this.process?.stdin.write(`${payload}\n`);
    });
  }

  private handleLine(line: string) {
    if (!line.trim()) return;

    const message = JSON.parse(line) as JsonRpcResponse | JsonRpcNotification;

    if ('id' in message) {
      this.handleResponse(message);
      return;
    }

    this.handleNotification(message);
  }

  private handleResponse(response: JsonRpcResponse) {
    const pending = this.pendingRequests.get(response.id);

    if (!pending) return;

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    if (response.error) {
      pending.reject(new Error(response.error.message || 'Erro desconhecido do Codex App Server.'));
      return;
    }

    pending.resolve(response.result);
  }

  private handleNotification(notification: JsonRpcNotification) {
    const listeners = this.notificationListeners.get(notification.method);

    listeners?.forEach((listener) => listener(notification.params));
  }

  private rejectAll(error: Error) {
    this.pendingRequests.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(error);
    });
    this.pendingRequests.clear();
  }
}

export const codexRpc = new CodexRpcClient();
