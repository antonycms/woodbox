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

let server: Server | undefined;
let currentHost = DEFAULT_HOST;
let currentPort = DEFAULT_PORT;
const sockets = new Set<Socket>();
const keepAliveSources = new Set<string>();

interface SocketState {
  id: string;
  buffer: Buffer;
  helloReceived: boolean;
}

const socketStates = new WeakMap<Socket, SocketState>();

const getAcceptKey = (key: string) => {
  return createHash('sha1').update(key + WS_GUID).digest('base64');
};

const encodeFrame = (text: string) => {
  const payload = Buffer.from(text);
  const headerLength = payload.length < 126 ? 2 : payload.length <= 65535 ? 4 : 10;
  const frame = Buffer.alloc(headerLength + payload.length);

  frame[0] = 0x81;

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
  const messages: string[] = [];

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

    if (opcode === 0x8) {
      state.buffer = state.buffer.slice(frameLength);
      break;
    }

    const mask = masked ? state.buffer.subarray(offset, offset + 4) : undefined;
    const payload = Buffer.from(
      state.buffer.subarray(offset + maskOffset, offset + maskOffset + payloadLength),
    );

    if (mask) {
      for (let index = 0; index < payload.length; index += 1) {
        payload[index] = payload[index] ^ mask[index % 4];
      }
    }

    if (opcode === 0x1) messages.push(payload.toString('utf8'));

    state.buffer = state.buffer.slice(frameLength);
  }

  return messages;
};

const sendJson = (socket: Socket, data: unknown) => {
  socket.write(encodeFrame(JSON.stringify(data)));
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
    netSocket.write(
      [
        'HTTP/1.1 101 Switching Protocols',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Accept: ${getAcceptKey(key)}`,
        '',
        '',
      ].join('\r\n'),
    );

    socketStates.set(netSocket, { id, buffer: Buffer.alloc(0), helloReceived: false });

    netSocket.on('data', (chunk) => {
      const state = socketStates.get(netSocket);
      if (!state) return;

      state.buffer = Buffer.concat([
        state.buffer,
        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
      ]);

      try {
        for (const raw of decodeFrames(state)) {
          handleBridgeMessage(netSocket, state, raw);
        }
      } catch (error) {
        console.error(error);
        netSocket.destroy();
      }
    });

    netSocket.on('close', () => {
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
  sockets.forEach((socket) => socket.destroy());
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
