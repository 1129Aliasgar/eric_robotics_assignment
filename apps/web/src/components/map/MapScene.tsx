import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { AlertTriangle, LoaderCircle, RotateCcw } from 'lucide-react';
import { MapEngine } from '../../lib/mapEngine';
import { useDashboardStore } from '../../store/dashboardStore';
import { useToastStore } from '../../store/toastStore';
import { useUiStore } from '../../store/uiStore';

type LoadState = {
  progress: number;
  label: string;
};

export default function MapScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MapEngine | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<string | null>(null);
  const [load, setLoad] = useState<LoadState>({ progress: 0.04, label: 'Waking map engine' });
  const [ready, setReady] = useState(false);
  const [hintVisible, setHintVisible] = useState(false);
  const reducedMotion = useReducedMotion();

  const mapZoom = useUiStore((state) => state.mapZoom);
  const scanEnabled = useUiStore((state) => state.scanEnabled);
  const routeVisible = useUiStore((state) => state.routeVisible);
  const resetMapNonce = useUiStore((state) => state.resetMapNonce);
  const pushToast = useToastStore((state) => state.push);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setFailure(null);
    setReady(false);
    setLoad({ progress: 0.04, label: 'Waking map engine' });

    let engine: MapEngine;
    try {
      engine = new MapEngine({
        container,
        reducedMotion: Boolean(reducedMotion),
        onProgress: (progress, label) => setLoad({ progress, label }),
        onReady: () => {
          setReady(true);
          setLoad({ progress: 1, label: 'Map online' });
        },
        onError: (message) => setFailure(message),
        onNotice: (message) => pushToast(message, 'warning'),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'The 3D map could not start. Check WebGL support.';
      window.requestAnimationFrame(() => setFailure(message));
      return;
    }

    engineRef.current = engine;

    const initial = useDashboardStore.getState().telemetry;
    engine.snapToPose(initial.robot.pose);
    engine.setGoal(initial.goal.id, initial.mission.status);
    engine.setMissionStatus(initial.mission.status);
    engine.setRoute(initial.goal.route);
    engine.setRouteVisible(useUiStore.getState().routeVisible);
    engine.setScanEnabled(useUiStore.getState().scanEnabled);
    engine.setZoom(useUiStore.getState().mapZoom);

    let lastRouteKey = '';
    let lastGoalId: string | null | undefined;
    let lastStatus = '';
    let hintTimer: number | null = null;

    const unsubscribe = useDashboardStore.subscribe((state) => {
      const { robot, mission, goal } = state.telemetry;
      engine.setTargetPose(robot.pose);

      if (goal.id !== lastGoalId || mission.status !== lastStatus) {
        engine.setGoal(goal.id, mission.status);
        lastGoalId = goal.id;
        lastStatus = mission.status;
      }
      engine.setMissionStatus(mission.status);

      const routeKey = `${goal.id ?? 'none'}:${goal.waypointIndex}:${goal.route.length}:${goal.route[0]?.x ?? 0}:${goal.route[0]?.z ?? 0}`;
      if (routeKey !== lastRouteKey) {
        engine.setRoute(goal.route);
        lastRouteKey = routeKey;
      }
    });

    const timer = window.setTimeout(() => {
      if (reducedMotion) {
        setHintVisible(true);
        hintTimer = window.setTimeout(() => setHintVisible(false), 5200);
      } else {
        setHintVisible(true);
        hintTimer = window.setTimeout(() => setHintVisible(false), 6200);
      }
    }, 1600);

    return () => {
      unsubscribe();
      window.clearTimeout(timer);
      if (hintTimer !== null) window.clearTimeout(hintTimer);
      engine.dispose();
      engineRef.current = null;
    };
  }, [attempt, pushToast, reducedMotion]);

  useEffect(() => {
    engineRef.current?.setZoom(mapZoom);
  }, [mapZoom, ready]);

  useEffect(() => {
    engineRef.current?.setScanEnabled(scanEnabled);
  }, [scanEnabled, ready]);

  useEffect(() => {
    engineRef.current?.setRouteVisible(routeVisible);
  }, [routeVisible, ready]);

  useEffect(() => {
    if (resetMapNonce > 0) engineRef.current?.resetView();
  }, [resetMapNonce]);

  return (
    <div
      className="map-surface absolute inset-0 overflow-hidden"
      role="region"
      aria-label="3D floor plan"
    >
      <div ref={containerRef} className="absolute inset-0" />

      <AnimatePresence>
        {!ready && !failure && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2"
          >
            <div className="dark-pill gap-3 px-4 py-2.5 shadow-2xl">
              <LoaderCircle className="text-safety-400 size-3.5 animate-spin" aria-hidden />
              <span className="text-[10px] font-semibold tracking-[0.14em] uppercase">
                {load.label}
              </span>
              <span className="font-mono text-[10px] text-white/55 tabular-nums">
                {Math.round(load.progress * 100)}%
              </span>
              <span className="h-1 w-16 overflow-hidden rounded-full bg-white/15">
                <motion.span
                  className="bg-safety-400 block h-full rounded-full"
                  initial={{ width: '4%' }}
                  animate={{ width: `${Math.max(4, load.progress * 100)}%` }}
                  transition={{ type: 'spring', stiffness: 90, damping: 20 }}
                />
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {failure && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-30 grid place-items-center bg-mist-300/80 p-6 backdrop-blur-sm"
          >
            <div className="bg-paper shadow-panel max-w-sm rounded-2xl p-6 text-center">
              <span className="bg-alert-500/10 text-alert-500 mx-auto grid size-11 place-items-center rounded-full">
                <AlertTriangle className="size-5" aria-hidden />
              </span>
              <h2 className="mt-4 text-sm font-semibold tracking-tight">3D map unavailable</h2>
              <p className="text-steel-500 mt-1.5 text-xs leading-relaxed">{failure}</p>
              <button
                type="button"
                onClick={() => setAttempt((value) => value + 1)}
                className="bg-ink-900 hover:bg-ink-800 mt-5 inline-flex h-9 items-center gap-2 rounded-full px-4 text-[11px] font-semibold text-white transition"
              >
                <RotateCcw className="size-3.5" aria-hidden />
                Retry map
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {ready && hintVisible && !failure && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="pointer-events-none absolute bottom-5 left-1/2 z-10 hidden -translate-x-1/2 md:block"
          >
            <div className="text-steel-500 rounded-full border border-white/40 bg-white/55 px-3 py-1.5 text-[9px] font-medium tracking-wide shadow-sm backdrop-blur-md">
              Drag to pan · Scroll to zoom · Right-drag to tilt
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
