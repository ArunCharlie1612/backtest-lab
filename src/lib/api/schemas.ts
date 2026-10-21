import { z } from "zod";

export const orderSideSchema = z.enum(["long", "short"]);
export const exitReasonSchema = z.enum([
  "stop_loss",
  "take_profit",
  "manual",
  "liquidation",
]);

export const createTradeSchema = z.object({
  sessionId: z.string().min(1),
  symbol: z.string().min(1),
  side: orderSideSchema,
  lots: z.number().positive(),
  entryPrice: z.number(),
  exitPrice: z.number(),
  entryTime: z.number().int(),
  exitTime: z.number().int(),
  durationSec: z.number().int().nonnegative(),
  grossPnl: z.number(),
  commission: z.number().nonnegative(),
  slippage: z.number().nonnegative(),
  netPnl: z.number(),
  rMultiple: z.number().nullish(),
  exitReason: exitReasonSchema,
  notes: z.string().max(5000).nullish(),
  snapshotUrl: z.string().nullish(),
  tagIds: z.array(z.string()).optional(),
});

export const updateTradeSchema = z.object({
  notes: z.string().max(5000).nullish(),
  snapshotUrl: z.string().nullish(),
  tagIds: z.array(z.string()).optional(),
});

export const createSessionSchema = z.object({
  userId: z.string().min(1),
  accountId: z.string().min(1),
  symbol: z.string().min(1),
  timeframe: z.enum(["1m", "5m", "15m", "1h", "4h", "1D"]),
  startTime: z.number().int(),
  endTime: z.number().int(),
  spreadPips: z.number().nonnegative().default(0.5),
  slippagePips: z.number().nonnegative().default(0.1),
  commission: z.number().nonnegative().default(7),
});

export type CreateTradeInput = z.infer<typeof createTradeSchema>;
export type UpdateTradeInput = z.infer<typeof updateTradeSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
