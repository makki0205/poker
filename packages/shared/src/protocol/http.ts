import { z } from 'zod';

export const durationSchema = z.union([z.literal(30), z.literal(60), z.literal(90)]);

export const createTournamentSchema = z.object({
  name: z.string().min(1).max(60),
  durationMinutes: durationSchema,
  maxSeats: z.literal(9),
  startingStack: z.number().int().min(100),
  botCount: z.number().int().min(0).max(8)
});

export const joinSchema = z.object({
  name: z.string().min(1).max(30)
});

export const rebuySchema = z.object({
  playerId: z.string().min(1)
});

export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;
export type JoinInput = z.infer<typeof joinSchema>;
export type RebuyInput = z.infer<typeof rebuySchema>;
