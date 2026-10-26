import { create } from 'zustand';
import { floorplan, planRoute } from '@insight/shared';
import type { Point2, TelemetryState } from '@insight/shared';

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline';

export type HistoryPoint = {
  at: number;
  battery: number;
  signalBars: number;
  progress: number;
};

type DashboardState = {
  telemetry: TelemetryState;
  connection: ConnectionState;
  lastMessageAt: number | null;
  history: HistoryPoint[];
  hydrate: (telemetry: TelemetryState) => void;
  applyTelemetry: (telemetry: TelemetryState) => void;
  setConnection: (connection: ConnectionState) => void;
};

const initialRoute: Point2[] = planRoute(floorplan.robotStart, 'n5');

export const initialTelemetry: TelemetryState = {
  sequence: 0,
  serverTime: new Date().toISOString(),
  mission: {
    id: 1234,
    status: 'active',
    goalId: 'storage-1',
    startedAt: new Date().toISOString(),
    elapsedSeconds: 0,
    progress: 0,
  },
  robot: {
    pose: { ...floorplan.robotStart },
    velocity: { linear: 0, angular: 0 },
    mode: 'auto',
    odometer: 0,
  },
  health: {
    battery: 100,
    signal: 'strong',
    signalBars: 4,
    failsafe: 'okay',
    system: 'okay',
  },
  goal: {
    id: 'storage-1',
    name: 'Storage 1',
    route: initialRoute,
    waypointIndex: 0,
  },
};

const MAX_HISTORY = 180;

function appendHistory(history: HistoryPoint[], telemetry: TelemetryState): HistoryPoint[] {
  const last = history[history.length - 1];
  if (last && Date.now() - last.at < 1000) return history;
  return [...history, historyPoint(telemetry)].slice(-MAX_HISTORY);
}

function historyPoint(telemetry: TelemetryState): HistoryPoint {
  return {
    at: Date.now(),
    battery: telemetry.health.battery,
    signalBars: telemetry.health.signalBars,
    progress: telemetry.mission.progress,
  };
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  telemetry: initialTelemetry,
  connection: 'connecting',
  lastMessageAt: null,
  history: [historyPoint(initialTelemetry)],
  hydrate: (telemetry) => {
    set((state) => ({
      telemetry,
      lastMessageAt: Date.now(),
      history: appendHistory(state.history, telemetry),
    }));
  },
  applyTelemetry: (telemetry) => {
    if (telemetry.sequence < get().telemetry.sequence) return;
    set((state) => ({
      telemetry,
      lastMessageAt: Date.now(),
      history:
        telemetry.sequence === state.telemetry.sequence
          ? state.history
          : [...state.history, historyPoint(telemetry)].slice(-MAX_HISTORY),
    }));
  },
  setConnection: (connection) => set({ connection }),
}));
