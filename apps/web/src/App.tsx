import { useCallback } from 'react';
import { EmergencyStop } from './components/controls/EmergencyStop';
import { Joystick } from './components/controls/Joystick';
import { Toaster } from './components/hud/Toaster';
import { TopHud } from './components/hud/Hud';
import { Sidebar } from './components/layout/Sidebar';
import { EmergencyResetModal } from './components/modals/EmergencyResetModal';
import { QuickGoalModal } from './components/modals/QuickGoalModal';
import { SidePanel } from './components/panels/SidePanel';
import { ViewStack } from './components/views/ViewStack';
import { useDriveController } from './hooks/useDriveController';
import { useHotkeys } from './hooks/useHotkeys';
import { useRobotCommands } from './hooks/useRobotCommands';
import { useTelemetryStream } from './hooks/useTelemetryStream';
import { useDashboardStore } from './store/dashboardStore';
import { useUiStore } from './store/uiStore';

export default function App() {
  useTelemetryStream();

  const telemetry = useDashboardStore((state) => state.telemetry);
  const connection = useDashboardStore((state) => state.connection);
  const commands = useRobotCommands();
  const { drive, stop } = useDriveController();

  const modal = useUiStore((state) => state.modal);
  const openModal = useUiStore((state) => state.openModal);
  const closeModal = useUiStore((state) => state.closeModal);
  const togglePrimaryView = useUiStore((state) => state.togglePrimaryView);

  const openQuickGoal = useCallback(() => {
    if (!useUiStore.getState().modal) openModal('quick-goal');
  }, [openModal]);

  const openEstopReset = useCallback(() => {
    openModal('estop-reset');
  }, [openModal]);

  const togglePause = useCallback(() => {
    if (useUiStore.getState().modal) return;
    const state = useDashboardStore.getState().telemetry;
    if (state.mission.status === 'estop') {
      openModal('estop-reset');
      return;
    }
    if (state.mission.status === 'active') void commands.pause();
    else if (state.mission.status === 'paused') void commands.resume();
    else void commands.initiate();
  }, [commands, openModal]);

  const toggleMode = useCallback(() => {
    if (useUiStore.getState().modal) return;
    const state = useDashboardStore.getState().telemetry;
    if (state.mission.status === 'estop' || state.health.failsafe === 'triggered') {
      openModal('estop-reset');
      return;
    }
    void commands.setMode(state.robot.mode === 'auto' ? 'manual' : 'auto');
  }, [commands, openModal]);

  const handleEscape = useCallback(() => {
    const ui = useUiStore.getState();
    if (ui.modal) {
      ui.closeModal();
    } else if (ui.drawer) {
      ui.setDrawer(null);
    }
  }, []);

  useHotkeys({
    onQuickGoal: openQuickGoal,
    onTogglePause: togglePause,
    onToggleMode: toggleMode,
    onToggleView: () => {
      if (!useUiStore.getState().modal) togglePrimaryView();
    },
    onEscape: handleEscape,
  });

  return (
    <div className="grain text-ink-900 relative h-dvh w-full overflow-hidden bg-mist-300">
      <h1 className="sr-only">Insight.IO autonomous robot mission control</h1>
      <Sidebar />

      <main className="absolute inset-x-0 top-0 bottom-[calc(56px+env(safe-area-inset-bottom))] overflow-hidden md:bottom-0 md:left-16 lg:left-[96px]">
        <ViewStack />

        <TopHud
          telemetry={telemetry}
          connection={connection}
          commands={commands}
          onQuickGoal={openQuickGoal}
          onEstopReset={openEstopReset}
        />

        <div className="absolute right-3 bottom-3 z-40 flex flex-col items-center gap-4 sm:right-16 sm:bottom-24 sm:gap-12">
          <EmergencyStop
            active={telemetry.health.failsafe === 'triggered'}
            pending={commands.pending === 'estop'}
            onPress={() => void commands.emergencyStop()}
            onReset={openEstopReset}
          />
          <Joystick
            disabled={telemetry.mission.status === 'estop' || modal !== null}
            onDrive={drive}
            onStop={stop}
          />
        </div>

        <Toaster />
      </main>

      <QuickGoalModal open={modal === 'quick-goal'} onClose={closeModal} commands={commands} />
      <EmergencyResetModal
        open={modal === 'estop-reset'}
        onClose={closeModal}
        commands={commands}
      />
      <SidePanel commands={commands} />
    </div>
  );
}
