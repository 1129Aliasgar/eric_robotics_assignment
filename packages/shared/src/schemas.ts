import { z } from 'zod';

export const modeSchema = z.enum(['auto', 'manual']);
export const missionStatusSchema = z.enum(['active', 'paused', 'estop', 'complete', 'idle']);
export const signalLevelSchema = z.enum(['strong', 'good', 'weak', 'lost']);
export const healthStateSchema = z.enum(['okay', 'warning', 'error']);

export const point2Schema = z.object({
  x: z.number(),
  z: z.number(),
});

export const pose2Schema = point2Schema.extend({
  heading: z.number(),
});

export const goalCommandSchema = z.object({
  goalId: z.string().min(1).max(64),
});

export const modeCommandSchema = z.object({
  mode: modeSchema,
});

export const velocityCommandSchema = z.object({
  linear: z.number().min(-1).max(1),
  angular: z.number().min(-1).max(1),
});

export const telemetrySchema = z.object({
  sequence: z.number().int().nonnegative(),
  serverTime: z.string(),
  mission: z.object({
    id: z.number().int().nonnegative(),
    status: missionStatusSchema,
    goalId: z.string().nullable(),
    startedAt: z.string().nullable(),
    elapsedSeconds: z.number().nonnegative(),
    progress: z.number().min(0).max(1),
  }),
  robot: z.object({
    pose: pose2Schema,
    velocity: z.object({
      linear: z.number(),
      angular: z.number(),
    }),
    mode: modeSchema,
    odometer: z.number().nonnegative(),
  }),
  health: z.object({
    battery: z.number().min(0).max(100),
    signal: signalLevelSchema,
    signalBars: z.number().int().min(0).max(4),
    failsafe: z.enum(['okay', 'triggered']),
    system: healthStateSchema,
  }),
  goal: z.object({
    id: z.string().nullable(),
    name: z.string().nullable(),
    route: z.array(point2Schema),
    waypointIndex: z.number().int().nonnegative(),
  }),
});

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    requestId: z.string(),
  }),
});
