import { useState } from 'react';
import { ArrowRight, Check, LoaderCircle, MapPin, Navigation } from 'lucide-react';
import { floorplan } from '@insight/shared';
import type { RobotCommands } from '../../hooks/useRobotCommands';
import { cx } from '../../lib/format';
import { estimateGoal, zoneLabelForGoal } from '../../lib/goals';
import { useDashboardStore } from '../../store/dashboardStore';
import { Modal } from '../ui/Modal';

type QuickGoalModalProps = {
  open: boolean;
  onClose: () => void;
  commands: RobotCommands;
};

export function QuickGoalModal({ open, onClose, commands }: QuickGoalModalProps) {
  const telemetry = useDashboardStore((state) => state.telemetry);
  const [selected, setSelected] = useState<string>(telemetry.goal.id ?? floorplan.goals[0]!.id);
  const [wasOpen, setWasOpen] = useState(open);
  const submitting = commands.pending === 'goal';

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setSelected(telemetry.goal.id ?? floorplan.goals[0]!.id);
  }

  const handleSubmit = async () => {
    const result = await commands.setGoal(selected);
    if (result) onClose();
  };

  const selectedGoal = floorplan.goals.find((goal) => goal.id === selected) ?? null;
  const selectedEstimate = selectedGoal ? estimateGoal(telemetry.robot.pose, selectedGoal) : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Mission targeting"
      title="Quick goal"
      description="Choose the next destination. The route is planned on the facility graph and updates live."
      icon={<Navigation className="size-4" strokeWidth={1.8} aria-hidden />}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="text-steel-500 hover:text-ink-900 h-9 rounded-full px-4 text-[11px] font-semibold transition hover:bg-mist-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!selectedGoal || submitting}
            className="bg-ink-900 hover:bg-ink-800 inline-flex h-9 items-center gap-2 rounded-full px-4 text-[11px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-55"
          >
            {submitting ? (
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
            ) : (
              <ArrowRight className="size-3.5" aria-hidden />
            )}
            Set goal
          </button>
        </>
      }
    >
      <div className="space-y-2 pb-6">
        {floorplan.goals.map((goal, index) => {
          const isSelected = selected === goal.id;
          const isCurrent = telemetry.goal.id === goal.id;
          const estimate = estimateGoal(telemetry.robot.pose, goal);

          return (
            <button
              key={goal.id}
              type="button"
              onClick={() => setSelected(goal.id)}
              aria-pressed={isSelected}
              className={cx(
                'group flex w-full items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition duration-200',
                isSelected
                  ? 'border-ink-900/20 bg-blush-100/70 shadow-[0_10px_24px_-18px_rgba(13,20,31,0.5)]'
                  : 'border-ink-900/[0.07] hover:border-ink-900/15 bg-mist-50/55 hover:bg-mist-50',
              )}
            >
              <span
                className={cx(
                  'grid size-9 shrink-0 place-items-center rounded-full border text-[9px] font-bold tabular-nums',
                  isSelected
                    ? 'border-ink-900 bg-ink-900 text-white'
                    : 'border-ink-900/12 bg-paper text-steel-400',
                )}
              >
                {isSelected ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  String(index + 1).padStart(2, '0')
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="text-ink-900 text-[13px] font-semibold tracking-[-0.01em]">
                    {goal.name}
                  </span>
                  {isCurrent && (
                    <span className="bg-ink-900/8 text-steel-500 rounded-full px-1.5 py-0.5 text-[7.5px] font-bold tracking-[0.12em] uppercase">
                      Current
                    </span>
                  )}
                </span>
                <span className="text-steel-500 mt-0.5 block truncate text-[10.5px]">
                  {goal.description}
                </span>
                <span className="text-steel-400 mt-1.5 flex items-center gap-1.5 text-[8.5px] font-semibold tracking-[0.12em] uppercase">
                  <MapPin className="size-2.5" aria-hidden />
                  {zoneLabelForGoal(goal)}
                </span>
              </span>

              <span className="shrink-0 text-right leading-none">
                <span className="text-ink-900 block text-[11px] font-semibold tabular-nums">
                  {estimate.distanceLabel}
                </span>
                <span className="text-steel-400 mt-1 block text-[9px]">{estimate.etaLabel}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="text-steel-500 mb-6 flex items-start gap-2 rounded-xl bg-mist-50 px-3.5 py-3 text-[10px] leading-relaxed">
        <span className="bg-safety-400 mt-[3px] size-1.5 shrink-0 rounded-full" aria-hidden />
        {telemetry.mission.status === 'active'
          ? `Setting a new goal retargets mission ${telemetry.mission.id} immediately. Estimated route: ${selectedEstimate?.distanceLabel ?? '—'}.`
          : 'The new goal is prepared for the next mission. Use Initiate when you are ready to start.'}
      </div>
    </Modal>
  );
}
