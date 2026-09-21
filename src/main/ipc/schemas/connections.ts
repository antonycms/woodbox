import { z } from 'zod';

export const dialect = z.enum(['postgres', 'mysql', 'sqlite', 'react-native-sqlite']);

const ssh = z.object({
  enabled: z.boolean(), host: z.string(), port: z.number(), username: z.string(),
  authMethod: z.enum(['password', 'privateKey', 'agent']),
  password: z.string().optional(), privateKeyPath: z.string().optional(),
  passphrase: z.string().optional(), agentPath: z.string().optional(),
});

export const connection = z.object({
  id_project: z.string(), description: z.string(), dialect,
  environment: z.enum(['development', 'production']).optional(),
  database: z.string(), host: z.string(), port: z.number(),
  username: z.string().optional(), password: z.string().optional(),
  ssl: z.boolean().optional(), sslRejectUnauthorized: z.boolean().optional(),
  sslCaCert: z.string().optional(), sslCert: z.string().optional(), sslKey: z.string().optional(),
  ssh: ssh.optional(),
  reactNativeBridge: z.object({
    appId: z.string().optional(), appName: z.string().optional(), adapterId: z.string(),
    adapterLabel: z.string().optional(), port: z.number().optional(),
    platform: z.enum(['android', 'ios', 'unknown']).optional(), deviceName: z.string().optional(),
  }).optional(),
});

export const importConnections = z.object({
  source: z.literal('dbeaver'), path: z.string(), masterPassword: z.string().optional(),
  selection: z.object({
    projects: z.array(z.object({ sourceName: z.string(), connections: z.array(z.string()) })),
  }).optional(),
});
