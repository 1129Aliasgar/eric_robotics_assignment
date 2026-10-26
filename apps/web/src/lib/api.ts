import { telemetrySchema } from '@insight/shared';
import type { RobotMode, TelemetryState } from '@insight/shared';

type VelocityCommand = {
  linear: number;
  angular: number;
};

const REQUEST_TIMEOUT_MS = 8_000;

export class ApiRequestError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(message: string, code = 'REQUEST_FAILED', status = 0) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.status = status;
  }
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
      signal: controller.signal,
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
      throw new ApiRequestError(
        error?.message ?? `Request failed with status ${response.status}.`,
        error?.code ?? 'REQUEST_FAILED',
        response.status,
      );
    }

    if (
      !payload ||
      typeof payload !== 'object' ||
      !('ok' in payload) ||
      payload.ok !== true ||
      !('data' in payload)
    ) {
      throw new ApiRequestError('The server returned an unexpected response.', 'BAD_RESPONSE');
    }

    return payload.data;
  } catch (error) {
    if (error instanceof ApiRequestError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiRequestError('The robot link timed out. Try again.', 'TIMEOUT');
    }
    throw new ApiRequestError('The robot link is unavailable. Check the local server.', 'OFFLINE');
  } finally {
    window.clearTimeout(timeout);
  }
}

function parseTelemetry(payload: unknown): TelemetryState {
  const result = telemetrySchema.safeParse(payload);
  if (!result.success) {
    throw new ApiRequestError('The server sent invalid telemetry.', 'INVALID_TELEMETRY');
  }
  return result.data;
}

async function command(path: string, body?: unknown): Promise<TelemetryState> {
  const payload = await request(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parseTelemetry(payload);
}

export const api = {
  async getState(): Promise<TelemetryState> {
    return parseTelemetry(await request('/api/state'));
  },
  setGoal(goalId: string) {
    return command('/api/mission/goal', { goalId });
  },
  initiate(goalId?: string) {
    return command('/api/mission/initiate', goalId ? { goalId } : undefined);
  },
  pause() {
    return command('/api/mission/pause');
  },
  resume() {
    return command('/api/mission/resume');
  },
  setMode(mode: RobotMode) {
    return command('/api/robot/mode', { mode });
  },
  setVelocity(velocity: VelocityCommand) {
    return command('/api/robot/velocity', velocity);
  },
  emergencyStop() {
    return command('/api/emergency/stop');
  },
  resetEmergencyStop() {
    return command('/api/emergency/reset');
  },
};

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === 'AbortError';
}

export function messageForError(error: unknown): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong. Try again.';
}
