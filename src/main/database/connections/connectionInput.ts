import { getDialectAdapter, getDialectIds } from '../dialects';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// Projection only: the IPC schema validates the canonical result before any handler.
export const normalizeConnectionInput = (input: unknown): unknown => {
  if (!isRecord(input)) return input;

  const dialect = getDialectIds().find((id) => id === input.dialect);
  if (!dialect) return input;

  const descriptor = getDialectAdapter(dialect).connectionDescriptor;
  const isNetwork = descriptor.mode === 'network';
  const isBridge = descriptor.mode === 'react-native-bridge';
  const bridge = isRecord(input.reactNativeBridge) ? input.reactNativeBridge : undefined;
  const useSsl = !!(descriptor.supportsSsl && input.ssl);
  const port = isNetwork && (typeof input.port === 'string' || typeof input.port === 'number')
    ? Number(input.port)
    : input.port;

  return {
    ...input,
    host: isNetwork ? input.host : '',
    port: isNetwork ? port : 0,
    database: isBridge ? bridge?.adapterLabel || bridge?.adapterId || '' : input.database,
    username: isBridge ? '' : input.username,
    password: isBridge ? '' : input.password,
    ssl: useSsl,
    sslRejectUnauthorized: useSsl ? !!input.sslRejectUnauthorized : false,
    sslCaCert: useSsl ? input.sslCaCert : '',
    sslCert: useSsl ? input.sslCert : '',
    sslKey: useSsl ? input.sslKey : '',
    ssh: isNetwork ? input.ssh : undefined,
    reactNativeBridge: isBridge ? input.reactNativeBridge : undefined,
  };
};
