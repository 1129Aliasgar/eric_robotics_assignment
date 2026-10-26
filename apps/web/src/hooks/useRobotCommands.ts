import { useCallback, useState } from 'react';
import type { RobotMode, TelemetryState } from '@insight/shared';
import { api, messageForError } from '../lib/api';
import { findGoal } from '../lib/goals';
import { useDashboardStore } from '../store/dashboardStore';
import { useToastStore } from '../store/toastStore';

export type CommandAction = 'goal' | 'initiate' | 'pause' | 'resume' | 'mode' | 'estop' | 'reset';

export function useRobotCommands() {
  const [pending, setPending] = useState<CommandAction | null>(null);
  const applyTelemetry = useDashboardStore((state) => state.applyTelemetry);
  const pushToast = useToastStore((state) => state.push);

  const run = useCallback(
    async (
      action: CommandAction,
      request: () => Promise<TelemetryState>,
      successMessage?: (state: TelemetryState) => string,
      failureMessage = 'The command could not be completed.',
    ) => {
      setPending(action);
      try {
        const state = await request();
        applyTelemetry(state);
        if (successMessage) pushToast(successMessage(state), 'success');
        return state;
      } catch (error) {
        pushToast(`${failureMessage} ${messageForError(error)}`.trim(), 'danger');
        return null;
      } finally {
        setPending(null);
      }
    },
    [applyTelemetry, pushToast],
  );

  const setGoal = useCallback(
    (goalId: string) => {
      const goal = findGoal(goalId);
      return run(
        'goal',
        () => api.setGoal(goalId),
        () => (goal ? `Route updated to ${goal.name}.` : 'Route updated.'),
        'Could not update the route.',
      );
    },
    [run],
  );

  const initiate = useCallback(
    (goalId?: string) =>
      run(
        'initiate',
        () => api.initiate(goalId),
        (state) => `Mission ${state.mission.id} initiated.`,
        'Could not initiate the mission.',
      ),
    [run],
  );

  const pause = useCallback(
    () =>
      run(
        'pause',
        () => api.pause(),
        () => 'Mission paused. The robot is holding position.',
        'Could not pause.',
      ),
    [run],
  );

  const resume = useCallback(
    () =>
      run(
        'resume',
        () => api.resume(),
        () => 'Mission resumed.',
        'Could not resume the mission.',
      ),
    [run],
  );

  const setMode = useCallback(
    (mode: RobotMode) =>
      run(
        'mode',
        () => api.setMode(mode),
        () =>
          mode === 'manual'
            ? 'Manual control enabled. Drive with the joystick or WASD.'
            : 'Autonomous mode engaged. Route following resumed.',
        'Could not change drive mode.',
      ),
    [run],
  );

  const emergencyStop = useCallback(
    () =>
      run(
        'estop',
        () => api.emergencyStop(),
        () => 'Emergency stop engaged. Drive power is cut.',
        'Emergency stop failed.',
      ),
    [run],
  );

  const resetEmergencyStop = useCallback(
    () =>
      run(
        'reset',
        () => api.resetEmergencyStop(),
        () => 'Emergency stop reset. The mission is paused.',
        'Could not reset the emergency stop.',
      ),
    [run],
  );

  return {
    pending,
    setGoal,
    initiate,
    pause,
    resume,
    setMode,
    emergencyStop,
    resetEmergencyStop,
  };
}

export type RobotCommands = ReturnType<typeof useRobotCommands>;
