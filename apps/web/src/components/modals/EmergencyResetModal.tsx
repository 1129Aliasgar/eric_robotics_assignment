import { LoaderCircle, ShieldAlert } from 'lucide-react';
import type { RobotCommands } from '../../hooks/useRobotCommands';
import { useDashboardStore } from '../../store/dashboardStore';
import { Modal } from '../ui/Modal';

type EmergencyResetModalProps = {
  open: boolean;
  onClose: () => void;
  commands: RobotCommands;
};

export function EmergencyResetModal({ open, onClose, commands }: EmergencyResetModalProps) {
  const missionId = useDashboardStore((state) => state.telemetry.mission.id);
  const pending = commands.pending === 'reset';

  const handleReset = async () => {
    const state = await commands.resetEmergencyStop();
    if (state) onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Safety interlock"
      title="Reset emergency stop?"
      description="Confirm the robot area is clear before restoring drive power. The active mission will remain paused."
      icon={<ShieldAlert className="text-alert-500 size-4" strokeWidth={1.8} aria-hidden />}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="text-steel-500 hover:text-ink-900 h-9 rounded-full px-4 text-[11px] font-semibold transition hover:bg-mist-100"
          >
            Keep stopped
          </button>
          <button
            type="button"
            onClick={() => void handleReset()}
            disabled={pending}
            className="bg-alert-500 hover:bg-alert-600 inline-flex h-9 items-center gap-2 rounded-full px-4 text-[11px] font-semibold text-white transition disabled:cursor-wait disabled:opacity-70"
          >
            {pending && <LoaderCircle className="size-3.5 animate-spin" aria-hidden />}
            Reset drive
          </button>
        </>
      }
    >
      <div className="space-y-3 pb-6">
        <div className="border-alert-500/15 bg-alert-500/[0.045] rounded-2xl border px-4 py-3.5">
          <p className="text-ink-900 text-[11px] font-semibold">Before restoring power</p>
          <ul className="text-steel-500 mt-2 space-y-1.5 text-[10.5px] leading-relaxed">
            <li className="flex gap-2">
              <span className="bg-alert-500 mt-[6px] size-1 shrink-0 rounded-full" aria-hidden />
              Confirm no operator is inside the robot cell.
            </li>
            <li className="flex gap-2">
              <span className="bg-alert-500 mt-[6px] size-1 shrink-0 rounded-full" aria-hidden />
              Check the aisle and charging bay are clear.
            </li>
            <li className="flex gap-2">
              <span className="bg-alert-500 mt-[6px] size-1 shrink-0 rounded-full" aria-hidden />
              Resume the mission only after the reset succeeds.
            </li>
          </ul>
        </div>
        <p className="text-steel-400 text-[10px] leading-relaxed">
          This action restores the drive system and leaves mission {`#${missionId}`} paused. It does
          not restart autonomous motion.
        </p>
      </div>
    </Modal>
  );
}
