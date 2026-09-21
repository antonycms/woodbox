import { z } from 'zod';

export const project = z.object({ id: z.string(), description: z.string() });

export const script = z.object({
  id: z.string(), name: z.string(), id_connection: z.string(), content: z.string().optional(),
  created_at: z.string(), updated_at: z.string(),
});

export const snippet = z.object({
  id: z.string(), name: z.string(), scope: z.string().optional(),
  prefix: z.union([z.string(), z.array(z.string())]),
  body: z.union([z.string(), z.array(z.string())]), description: z.string().optional(),
  created_at: z.string(), updated_at: z.string(),
});
