import type { ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  BatteryMedium,
  CircleAlert,
  CircleCheck,
  CircleX,
  LoaderCircle,
  Map as MapIcon,
  Pause,
  Play,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import type { SignalLevel, TelemetryState } from '@insight/shared';
import type { RobotCommands } from '../../hooks/useRobotCommands';
import { cx } from '../../lib/format';
import type { ConnectionState } from '../../store/dashboardStore';
import { useUiStore } from '../../store/uiStore';
import { Tooltip } from '../ui/Tooltip';

type TopHudProps = {
  telemetry: TelemetryState;
  connection: ConnectionState;
  commands: RobotCommands;
  onQuickGoal: () => void;
  onEstopReset: () => void;
};

const connectionCopy: Record<ConnectionState, string> = {
  connecting: 'Connecting to telemetry',
  live: 'Live telemetry',
  reconnecting: 'Reconnecting to telemetry',
  offline: 'Telemetry offline',
};

const connectionTone: Record<ConnectionState, string> = {
  connecting: 'bg-safety-400',
  live: 'bg-live-500',
  reconnecting: 'bg-safety-400',
  offline: 'bg-alert-500',
};

function statusHeading(telemetry: TelemetryState) {
  switch (telemetry.mission.status) {
    case 'active':
      return `On Mission ${telemetry.mission.id}`;
    case 'paused':
      return 'Mission Paused';
    case 'estop':
      return 'Emergency Stop';
    case 'complete':
      return 'Mission Complete';
    default:
      return 'Standby';
  }
}

function StatusPill({
  telemetry,
  connection,
  commands,
  onEstopReset,
}: {
  telemetry: TelemetryState;
  connection: ConnectionState;
  commands: RobotCommands;
  onEstopReset: () => void;
}) {
  const status = telemetry.mission.status;
  const pending = commands.pending;
  const busy = pending === 'pause' || pending === 'resume' || pending === 'initiate';

  const handleAction = () => {
    if (status === 'estop') {
      onEstopReset();
      return;
    }
    if (status === 'active') {
      void commands.pause();
    } else if (status === 'paused') {
      void commands.resume();
    } else {
      void commands.initiate();
    }
  };

  const actionLabel =
    status === 'estop'
      ? 'Reset emergency stop'
      : status === 'active'
        ? 'Pause mission (Space)'
        : status === 'paused'
          ? 'Resume mission (Space)'
          : 'Initiate mission (Space)';

  return (
    <div className="hud-pill h-[42px] gap-2.5 pr-3 pl-1.5" aria-label="Robot mission status">
      <Tooltip label={actionLabel} side="bottom">
        <button
          type="button"
          onClick={handleAction}
          disabled={busy}
          aria-label={actionLabel}
          className={cx(
            'icon-button size-[30px] border',
            status === 'estop'
              ? 'border-alert-500/20 bg-alert-500/10 text-alert-500 hover:bg-alert-500/15'
              : 'border-ink-900/10 text-ink-900 bg-mist-50 hover:bg-mist-100',
          )}
        >
          {busy ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          ) : status === 'estop' ? (
            <ShieldAlert className="size-3.5" aria-hidden />
          ) : status === 'active' ? (
            <Pause className="size-3.5 fill-current" aria-hidden />
          ) : (
            <Play className="size-3.5 fill-current" aria-hidden />
          )}
        </button>
      </Tooltip>
      <div className="min-w-0 leading-none">
        <div className="flex items-center gap-1.5">
          <span className="text-steel-400 text-[8px] font-semibold tracking-[0.16em] uppercase">
            Status
          </span>
          <Tooltip label={connectionCopy[connection]} side="bottom">
            <span
              className={cx(
                'size-[5px] rounded-full',
                connectionTone[connection],
                connection === 'live' && 'animate-pulse',
              )}
              aria-label={connectionCopy[connection]}
              role="status"
            />
          </Tooltip>
        </div>
        <p className="text-ink-900 mt-1 truncate text-[11px] font-semibold tracking-[-0.01em] sm:text-[12px]">
          {statusHeading(telemetry)}
        </p>
      </div>
    </div>
  );
}

function QuickGoalButton({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip label="Choose a destination (Q)" side="bottom">
      <button
        type="button"
        onClick={onClick}
        className="hud-pill group h-[42px] gap-4 pr-1.5 pl-4 transition hover:-translate-y-px hover:shadow-[0_14px_34px_-14px_rgba(13,20,31,0.35)]"
        aria-label="Open quick goal selector"
      >
        <span className="text-ink-900 text-[9px] font-bold tracking-[0.16em] uppercase">
          Quick goal
        </span>
        <span className="bg-ink-900 grid size-[30px] place-items-center rounded-full text-white transition-transform duration-200 group-hover:translate-x-0.5">
          <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
        </span>
      </button>
    </Tooltip>
  );
}

function SignalBars({ level }: { level: number }) {
  const color =
    level >= 3
      ? 'bg-live-500'
      : level >= 2
        ? 'bg-safety-400'
        : level >= 1
          ? 'bg-alert-500'
          : 'bg-alert-500';
  return (
    <span className="flex h-3.5 items-end gap-[2px]" aria-hidden>
      {[4, 7, 10, 13].map((height, index) => (
        <span
          key={height}
          className={cx('w-[2px] rounded-full', index < level ? color : 'bg-white/18')}
          style={{ height }}
        />
      ))}
    </span>
  );
}

function systemIcon(system: TelemetryState['health']['system']) {
  if (system === 'error') return <CircleX className="text-alert-500 size-3.5" aria-hidden />;
  if (system === 'warning') return <CircleAlert className="text-safety-400 size-3.5" aria-hidden />;
  return <CircleCheck className="text-live-500 size-3.5" aria-hidden />;
}

function TelemetryItem({
  icon,
  label,
  value,
  tone,
  wide,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone?: string;
  wide?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {icon}
      <div className="leading-none">
        <p className="eyebrow hidden text-white/38 sm:block">{label}</p>
        <p
          className={cx('text-[10px] font-semibold tabular-nums sm:mt-1', tone ?? 'text-white/90')}
        >
          {value}
        </p>
      </div>
      {wide && <span className="sr-only">{label}</span>}
    </div>
  );
}

function TelemetryBar({ telemetry }: { telemetry: TelemetryState }) {
  const battery = telemetry.health.battery;
  const batteryTone =
    battery > 45 ? 'text-white/90' : battery > 20 ? 'text-safety-400' : 'text-alert-500';
  const signal: SignalLevel = telemetry.health.signal;
  const signalLabel =
    signal === 'strong'
      ? 'Strong'
      : signal === 'good'
        ? 'Good'
        : signal === 'weak'
          ? 'Weak'
          : 'Lost';

  return (
    <div
      className="dark-pill h-[42px] gap-3 px-3.5 sm:gap-4 sm:px-4"
      aria-label="Live robot telemetry"
    >
      <TelemetryItem
        icon={<BatteryMedium className={cx('size-4', batteryTone)} aria-hidden />}
        label="Battery"
        value={`${Math.round(battery)}%`}
        tone={batteryTone}
      />
      <span className="h-4 w-px bg-white/12" aria-hidden />
      <TelemetryItem
        icon={<SignalBars level={telemetry.health.signalBars} />}
        label="Signal"
        value={signalLabel}
      />
      <span className="hidden h-4 w-px bg-white/12 sm:block" aria-hidden />
      <TelemetryItem
        icon={
          telemetry.health.failsafe === 'triggered' ? (
            <ShieldAlert className="text-alert-500 size-3.5" aria-hidden />
          ) : (
            <ShieldCheck className="text-live-500 size-3.5" aria-hidden />
          )
        }
        label="Failsafe"
        value={telemetry.health.failsafe === 'triggered' ? 'Triggered' : 'Okay'}
        tone={telemetry.health.failsafe === 'triggered' ? 'text-alert-500' : undefined}
      />
      <span className="hidden h-4 w-px bg-white/12 sm:block" aria-hidden />
      <TelemetryItem
        icon={systemIcon(telemetry.health.system)}
        label="System"
        value={
          telemetry.health.system === 'okay'
            ? 'Okay'
            : telemetry.health.system === 'warning'
              ? 'Warning'
              : 'Error'
        }
        tone={telemetry.health.system === 'warning' ? 'text-safety-400' : undefined}
        wide
      />
    </div>
  );
}

function ModeToggle({
  mode,
  disabled,
  pending,
  onChange,
}: {
  mode: TelemetryState['robot']['mode'];
  disabled: boolean;
  pending: boolean;
  onChange: (mode: 'auto' | 'manual') => void;
}) {
  return (
    <div className="hud-pill h-[42px] gap-2 pr-1.5 pl-2.5 sm:gap-3 sm:pl-4">
      <span className="eyebrow text-steel-400 hidden sm:block">Mode</span>
      <div
        className="relative flex h-8 items-center rounded-full bg-mist-100 p-0.5"
        role="radiogroup"
        aria-label="Drive mode"
      >
        {(['auto', 'manual'] as const).map((value) => {
          const selected = mode === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={disabled || pending}
              onClick={() => onChange(value)}
              className={cx(
                'relative z-10 h-7 w-[52px] rounded-full text-[8.5px] font-bold tracking-[0.12em] uppercase transition-colors duration-200 sm:w-[62px] sm:text-[9px]',
                selected ? 'text-white' : 'text-steel-500 hover:text-ink-900',
                (disabled || pending) && 'cursor-not-allowed opacity-60',
              )}
            >
              {selected && (
                <motion.span
                  layoutId="active-mode"
                  className="bg-ink-900 absolute inset-0 -z-10 rounded-full shadow-sm"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              {value}
            </button>
          );
        })}
        {pending && (
          <span className="pointer-events-none absolute inset-0 z-20 grid place-items-center rounded-full bg-mist-100/55">
            <LoaderCircle className="text-ink-900 size-3 animate-spin" aria-hidden />
          </span>
        )}
      </div>
    </div>
  );
}

function InitiateButton({
  disabled,
  pending,
  onClick,
}: {
  disabled: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip label={disabled ? 'Reset the emergency stop first' : 'Start or restart the mission'}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || pending}
        className={cx(
          'hud-pill group h-[42px] gap-3 pr-1.5 pl-4 transition',
          disabled || pending
            ? 'cursor-not-allowed opacity-55'
            : 'hover:-translate-y-px hover:shadow-[0_14px_34px_-14px_rgba(13,20,31,0.35)]',
        )}
        aria-label="Initiate mission"
      >
        <span className="text-ink-900 text-[9px] font-bold tracking-[0.15em] uppercase">
          Initiate
        </span>
        <span className="bg-ink-900 grid size-[30px] place-items-center rounded-full text-white transition-transform duration-200 group-hover:translate-x-0.5">
          {pending ? (
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
          )}
        </span>
      </button>
    </Tooltip>
  );
}

function MapViewLabel() {
  return (
    <Tooltip label="Drag to pan · Scroll to zoom · Right-drag to tilt" side="bottom">
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className="dark-pill gap-2 rounded-[8px] px-3 py-2"
      >
        <MapIcon className="size-3 text-white/70" aria-hidden />
        <span className="text-[9px] font-semibold tracking-[0.14em] text-white uppercase">
          Map View
        </span>
      </motion.div>
    </Tooltip>
  );
}

export function TopHud({
  telemetry,
  connection,
  commands,
  onQuickGoal,
  onEstopReset,
}: TopHudProps) {
  const primaryView = useUiStore((state) => state.primaryView);
  const modePending = commands.pending === 'mode';
  const modeDisabled =
    telemetry.mission.status === 'estop' || telemetry.health.failsafe === 'triggered';

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <div className="pointer-events-auto absolute top-3 left-3 flex flex-col items-start gap-2 sm:top-4 sm:left-4 sm:gap-2.5">
        <StatusPill
          telemetry={telemetry}
          connection={connection}
          commands={commands}
          onEstopReset={onEstopReset}
        />
        <QuickGoalButton onClick={onQuickGoal} />
      </div>

      <div className="pointer-events-auto absolute top-3 right-3 flex flex-col items-end gap-2 sm:top-4 sm:right-16 sm:gap-2.5">
        <ModeToggle
          mode={telemetry.robot.mode}
          disabled={modeDisabled}
          pending={modePending}
          onChange={(mode) => void commands.setMode(mode)}
        />
        <InitiateButton
          disabled={modeDisabled}
          pending={commands.pending === 'initiate'}
          onClick={() => void commands.initiate(telemetry.goal.id ?? undefined)}
        />
      </div>

      <div className="absolute top-[104px] left-1/2 -translate-x-1/2 sm:top-[108px] lg:top-4">
        <TelemetryBar telemetry={telemetry} />
      </div>

      <div className="absolute top-[158px] left-1/2 -translate-x-1/2 sm:top-[162px] lg:top-[70px]">
        <AnimatePresence>{primaryView === 'map' && <MapViewLabel />}</AnimatePresence>
      </div>
    </div>
  );
}
