import { useCallback, useEffect, useRef } from 'react';
import { api, messageForError } from '../lib/api';
import { useDashboardStore } from '../store/dashboardStore';
import { useToastStore } from '../store/toastStore';

export type DriveInput = {
  linear: number;
  angular: number;
};

const ZERO: DriveInput = { linear: 0, angular: 0 };
const SEND_INTERVAL_MS = 110;

function sameInput(a: DriveInput, b: DriveInput) {
  return Math.abs(a.linear - b.linear) < 0.005 && Math.abs(a.angular - b.angular) < 0.005;
}

export function useDriveController() {
  const inputRef = useRef<DriveInput>({ ...ZERO });
  const lastSentRef = useRef<DriveInput>({ ...ZERO });
  const readyRef = useRef(false);
  const preparingRef = useRef(false);
  const sendingRef = useRef(false);
  const movingRef = useRef(false);
  const lastErrorAtRef = useRef(0);

  const pushToast = useToastStore((state) => state.push);
  const applyTelemetry = useDashboardStore((state) => state.applyTelemetry);

  useEffect(
    () =>
      useDashboardStore.subscribe((state) => {
        const { mission, robot, health } = state.telemetry;
        if (
          robot.mode !== 'manual' ||
          mission.status !== 'active' ||
          health.failsafe === 'triggered'
        ) {
          readyRef.current = false;
        }
      }),
    [],
  );

  const ensureReady = useCallback(async () => {
    if (readyRef.current) return true;
    if (preparingRef.current) return false;
    preparingRef.current = true;

    try {
      let state = useDashboardStore.getState().telemetry;

      if (state.health.failsafe === 'triggered') {
        pushToast('Reset the emergency stop before driving.', 'warning');
        return false;
      }

      if (state.mission.status === 'paused') {
        state = await api.resume();
        applyTelemetry(state);
      } else if (state.mission.status !== 'active') {
        pushToast('Initiate a mission before taking manual control.', 'warning');
        return false;
      }

      if (state.robot.mode !== 'manual') {
        state = await api.setMode('manual');
        applyTelemetry(state);
        pushToast('Manual control enabled. Use WASD or the joystick.', 'info');
      }

      readyRef.current = true;
      return true;
    } catch (error) {
      pushToast(`Could not enable manual control. ${messageForError(error)}`, 'danger');
      return false;
    } finally {
      preparingRef.current = false;
    }
  }, [applyTelemetry, pushToast]);

  const drive = useCallback(
    (input: DriveInput) => {
      const next = {
        linear: Math.max(-1, Math.min(1, input.linear)),
        angular: Math.max(-1, Math.min(1, input.angular)),
      };
      inputRef.current = next;
      movingRef.current = Math.abs(next.linear) > 0.01 || Math.abs(next.angular) > 0.01;
      if (movingRef.current) {
        void ensureReady();
      }
    },
    [ensureReady],
  );

  const stop = useCallback(() => {
    inputRef.current = { ...ZERO };
    movingRef.current = false;
  }, []);

  useEffect(() => {
    const timer = window.setInterval(async () => {
      if (sendingRef.current) return;

      const input = inputRef.current;
      const shouldSend =
        movingRef.current || !sameInput(lastSentRef.current, ZERO) || !sameInput(input, ZERO);
      if (!shouldSend || !readyRef.current) return;

      sendingRef.current = true;
      try {
        await api.setVelocity(input);
        lastSentRef.current = { ...input };
      } catch (error) {
        const now = Date.now();
        if (now - lastErrorAtRef.current > 6_000) {
          lastErrorAtRef.current = now;
          pushToast(`Drive command failed. ${messageForError(error)}`, 'warning');
        }
        readyRef.current = false;
      } finally {
        sendingRef.current = false;
      }
    }, SEND_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      inputRef.current = { ...ZERO };
      if (readyRef.current && !sameInput(lastSentRef.current, ZERO)) {
        void api.setVelocity(ZERO).catch(() => undefined);
      }
    };
  }, [pushToast]);

  return { drive, stop };
}
