import { createHash } from 'crypto';
import { createServer, type Server } from 'http';
import type { Socket } from 'net';
import { emitEvent } from '@main/utils/emitEvent';
import {
  createSessionId,
  getReactNativeBridgeSessions,
  registerReactNativeBridgeSession,
  removeReactNativeBridgeSession,
  touchReactNativeBridgeSession,
} from './sessions';
import {
  rejectReactNativeBridgeSessionRequests,
  resolveReactNativeBridgeResponse,
} from './rpc';
import type {
  BridgeHelloMessage,
  BridgeMessage,
  BridgeResponseMessage,
  ReactNativeBridgeStatus,
} from './protocol';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_PORT = 8123;
const HEARTBEAT_INTERVAL_MS = 5000;
const HEARTBEAT_TIMEOUT_MS = 15000;

let server: Server | undefined;
let currentHost = DEFAULT_HOST;
let currentPort = DEFAULT_PORT;
const sockets = new Set<Socket>();
const keepAliveSources = new Set<string>();

interface SocketState {
  id: string;
  buffer: Buffer;
  helloReceived: boolean;
  lastSeenAt: number;
  heartbeatInterval?: NodeJS.Timeout;
}

const socketStates = new WeakMap<Socket, SocketState>();

interface DecodedFrame {
  opcode: number;
  payload: Buffer;
}

const getAcceptKey = (key: string) => {
  return createHash('sha1').update(key + WS_GUID).digest('base64');
};

const encodeFrame = (data: Buffer | string, opcode = 0x1) => {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const headerLength = payload.length < 126 ? 2 : payload.length <= 65535 ? 4 : 10;
  const frame = Buffer.alloc(headerLength + payload.length);

  frame[0] = 0x80 | opcode;

  if (payload.length < 126) {
    frame[1] = payload.length;
    payload.copy(frame, 2);
  } else if (payload.length <= 65535) {
    frame[1] = 126;
    frame.writeUInt16BE(payload.length, 2);
    payload.copy(frame, 4);
  } else {
    frame[1] = 127;
    frame.writeBigUInt64BE(BigInt(payload.length), 2);
    payload.copy(frame, 10);
  }

  return frame;
};

const decodeFrames = (state: SocketState) => {
  const frames: DecodedFrame[] = [];

  while (state.buffer.length >= 2) {
    const secondByte = state.buffer[1];
    const opcode = state.buffer[0] & 0x0f;
    const masked = (secondByte & 0x80) === 0x80;
    let payloadLength = secondByte & 0x7f;
    let offset = 2;

    if (payloadLength === 126) {
      if (state.buffer.length < 4) break;
      payloadLength = state.buffer.readUInt16BE(2);
      offset = 4;
    } else if (payloadLength === 127) {
      if (state.buffer.length < 10) break;
      payloadLength = Number(state.buffer.readBigUInt64BE(2));
      offset = 10;
    }

    const maskOffset = masked ? 4 : 0;
    const frameLength = offset + maskOffset + payloadLength;

    if (state.buffer.length < frameLength) break;

    const mask = masked ? state.buffer.subarray(offset, offset + 4) : undefined;
    const payload = Buffer.from(
      state.buffer.subarray(offset + maskOffset, offset + maskOffset + payloadLength),
    );

    if (mask) {
      for (let index = 0; index < payload.length; index += 1) {
        payload[index] = payload[index] ^ mask[index % 4];
      }
    }

    if (opcode === 0x1 || opcode === 0x8 || opcode === 0x9 || opcode === 0xa) {
      frames.push({ opcode, payload });
    }

    state.buffer = state.buffer.slice(frameLength);

    if (opcode === 0x8) break;
  }

  return frames;
};

const isIgnoredSocketError = (error: unknown) => {
  const code = (error as NodeJS.ErrnoException).code;

  return code === 'EPIPE' || code === 'ECONNRESET' || code === 'ERR_STREAM_DESTROYED';
};

const writeSocket = (socket: Socket, data: Buffer | string) => {
  if (socket.destroyed || !socket.writable || socket.writableEnded) return false;

  try {
    socket.write(data);
    return true;
  } catch (error) {
    if (!isIgnoredSocketError(error)) console.error(error);
    return false;
  }
};

const sendJson = (socket: Socket, data: unknown) => {
  const sent = writeSocket(socket, encodeFrame(JSON.stringify(data)));

  if (!sent) socket.destroy();

  return sent;
};

const sendPong = (socket: Socket, payload: Buffer) => {
  if (!writeSocket(socket, encodeFrame(payload, 0xa))) socket.destroy();
};

const sendClose = (socket: Socket) => {
  writeSocket(socket, encodeFrame(Buffer.alloc(0), 0x8));
  socket.destroy();
};

const startSocketHeartbeat = (socket: Socket, state: SocketState) => {
  state.heartbeatInterval = setInterval(() => {
    if (socket.destroyed) return;

    const inactiveMs = Date.now() - state.lastSeenAt;

    if (inactiveMs > HEARTBEAT_TIMEOUT_MS) {
      socket.destroy();
      return;
    }

    if (!writeSocket(socket, encodeFrame(Buffer.alloc(0), 0x9))) socket.destroy();
  }, HEARTBEAT_INTERVAL_MS);

  state.heartbeatInterval.unref?.();
};

const handleBridgeMessage = (socket: Socket, state: SocketState, raw: string) => {
  const message = JSON.parse(raw) as BridgeMessage;

  touchReactNativeBridgeSession(state.id);

  if (message.type === 'hello') {
    registerReactNativeBridgeSession(state.id, message as BridgeHelloMessage, (data) =>
      sendJson(socket, data),
    );
    state.helloReceived = true;
    return;
  }

  if (!state.helloReceived) {
    throw new Error('Bridge React Native não enviou hello.');
  }

  if (message.type === 'response') {
    resolveReactNativeBridgeResponse(message as BridgeResponseMessage);
    return;
  }

  if (message.type === 'event') {
    emitEvent('@event:react_native_bridge_event', message);
  }
};

const handleBridgeFrame = (socket: Socket, state: SocketState, frame: DecodedFrame) => {
  state.lastSeenAt = Date.now();
  touchReactNativeBridgeSession(state.id);

  if (frame.opcode === 0x8) {
    sendClose(socket);
    return;
  }

  if (frame.opcode === 0x9) {
    sendPong(socket, frame.payload);
    return;
  }

  if (frame.opcode === 0xa) return;

  if (frame.opcode === 0x1) {
    handleBridgeMessage(socket, state, frame.payload.toString('utf8'));
  }
};

export const getReactNativeBridgeStatus = (): ReactNativeBridgeStatus => ({
  running: !!server?.listening,
  host: currentHost,
  port: currentPort,
  sessions: getReactNativeBridgeSessions(),
});

export const ensureReactNativeBridgeGateway = async ({
  host = DEFAULT_HOST,
  port = DEFAULT_PORT,
}: { host?: string; port?: number } = {}) => {
  if (server?.listening) return getReactNativeBridgeStatus();

  currentHost = host;
  currentPort = port;

  server = createServer();

  server.on('upgrade', (request, socket) => {
    const netSocket = socket as Socket;
    const key = request.headers['sec-websocket-key'];

    if (!key || Array.isArray(key)) {
      netSocket.destroy();
      return;
    }

    const id = createSessionId();
    sockets.add(netSocket);
    netSocket.on('error', (error) => {
      if (!isIgnoredSocketError(error)) console.error(error);
    });

    const accepted = writeSocket(
      netSocket,
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${getAcceptKey(key)}`,
        '',
        '',
      ].join('\r\n'),
    );

    if (!accepted) {
      sockets.delete(netSocket);
      netSocket.destroy();
      return;
    }

    const state: SocketState = {
      id,
      buffer: Buffer.alloc(0),
      helloReceived: false,
      lastSeenAt: Date.now(),
    };

    socketStates.set(netSocket, state);
    startSocketHeartbeat(netSocket, state);

    netSocket.on('data', (chunk) => {
      const currentState = socketStates.get(netSocket);
      if (!currentState) return;

      currentState.buffer = Buffer.concat([
        currentState.buffer,
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
      ]);

      try {
        for (const frame of decodeFrames(currentState)) {
          handleBridgeFrame(netSocket, currentState, frame);
        }
      } catch (error) {
        console.error(error);
        netSocket.destroy();
      }
    });

    netSocket.on('close', () => {
      const currentState = socketStates.get(netSocket);
      if (currentState?.heartbeatInterval) clearInterval(currentState.heartbeatInterval);
      sockets.delete(netSocket);
      removeReactNativeBridgeSession(id);
      rejectReactNativeBridgeSessionRequests(id);
    });
  });

  await new Promise<void>((resolve, reject) => {
    server?.once('error', reject);
    server?.listen(port, host, () => {
      server?.off('error', reject);
      resolve();
    });
  });

  return getReactNativeBridgeStatus();
};

export const retainReactNativeBridgeGateway = async (
  source = 'manual',
  options: { host?: string; port?: number } = {},
) => {
  keepAliveSources.add(source);
  return ensureReactNativeBridgeGateway(options);
};

export const stopReactNativeBridgeGateway = async () => {
  keepAliveSources.clear();

  if (!server) return;

  const currentServer = server;
  server = undefined;
  sockets.forEach((socket) => {
    const state = socketStates.get(socket);
    if (state?.heartbeatInterval) clearInterval(state.heartbeatInterval);
    socket.destroy();
  });
  sockets.clear();

  await new Promise<void>((resolve, reject) => {
    currentServer.close((error) => (error ? reject(error) : resolve()));
  });
};

export const releaseReactNativeBridgeGateway = async (source = 'manual') => {
  keepAliveSources.delete(source);

  if (keepAliveSources.size) return;

  await stopReactNativeBridgeGateway();
};
