import { useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  BatteryMedium,
  Check,
  ChevronRight,
  CircleCheck,
  Gauge,
  Keyboard,
  MapPin,
  Navigation,
  Radio,
  ShieldCheck,
  Signal,
  UserRound,
  X,
} from 'lucide-react';
import { floorplan } from '@insight/shared';
import type { RobotCommands } from '../../hooks/useRobotCommands';
import {
  cx,
  formatClock,
  formatDuration,
  formatMeters,
  formatPercent,
  titleCase,
} from '../../lib/format';
import { estimateGoal, findGoal, headingDegrees } from '../../lib/goals';
import type { ConnectionState, HistoryPoint } from '../../store/dashboardStore';
import { useDashboardStore } from '../../store/dashboardStore';
import { useUiStore, type DrawerId } from '../../store/uiStore';

type SidePanelProps = {
  commands: RobotCommands;
};

const drawerMeta: Record<DrawerId, { eyebrow: string; title: string; icon: typeof MapPin }> = {
  locations: { eyebrow: 'Mission targeting', title: 'Destinations', icon: MapPin },
  activity: { eyebrow: 'Live diagnostics', title: 'Mission activity', icon: Activity },
  profile: { eyebrow: 'Insight facility', title: 'Operator', icon: UserRound },
};

const connectionLabel: Record<ConnectionState, string> = {
  connecting: 'Connecting',
  live: 'Live',
  reconnecting: 'Reconnecting',
  offline: 'Offline',
};

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="border-ink-900/10 bg-paper text-steel-500 inline-grid min-w-5 place-items-center rounded-md border px-1.5 py-1 font-mono text-[9px] font-medium shadow-[0_1px_0_rgba(13,20,31,0.08)]">
      {children}
    </kbd>
  );
}

function Sparkline({
  values,
  color,
  label,
  current,
}: {
  values: number[];
  color: string;
  label: string;
  current: string;
}) {
  const rawId = useId();
  const id = `spark-${rawId.replace(/:/g, '')}`;
  const width = 300;
  const height = 58;
  const padded = values.length > 1 ? values : [values[0] ?? 0, values[0] ?? 0];
  const points = padded.map((value, index) => {
    const x = (index / (padded.length - 1)) * width;
    const y = height - (Math.max(0, Math.min(100, value)) / 100) * height;
    return [x, y] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x},${y}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <div className="border-ink-900/[0.06] rounded-2xl border bg-mist-50/60 p-3.5">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow text-steel-400">{label}</span>
        <span className="text-ink-900 text-[11px] font-semibold tabular-nums">{current}</span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="mt-2 h-14 w-full overflow-visible"
        role="img"
        aria-label={`${label} history`}
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={ratio}
            x1="0"
            x2={width}
            y1={height * ratio}
            y2={height * ratio}
            stroke="rgba(13,20,31,0.06)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path d={area} fill={`url(#${id})`} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle
          cx={points[points.length - 1]?.[0] ?? width}
          cy={points[points.length - 1]?.[1] ?? height}
          r="3"
          fill={color}
          stroke="#fff"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}

function LocationsContent({ commands }: SidePanelProps) {
  const telemetry = useDashboardStore((state) => state.telemetry);
  const setDrawer = useUiStore((state) => state.setDrawer);
  const currentGoal = findGoal(telemetry.goal.id);
  const currentEstimate = currentGoal ? estimateGoal(telemetry.robot.pose, currentGoal) : null;
  const pending = commands.pending === 'goal';

  const selectGoal = async (goalId: string) => {
    const state = await commands.setGoal(goalId);
    if (state) setDrawer(null);
  };

  return (
    <div className="space-y-5">
      <div className="bg-ink-900 relative overflow-hidden rounded-2xl p-4 text-white">
        <div
          className="bg-blush-200/15 pointer-events-none absolute -top-12 -right-10 size-36 rounded-full blur-2xl"
          aria-hidden
        />
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow text-white/38">Current goal</p>
            <p className="mt-1.5 text-[15px] font-semibold tracking-[-0.02em]">
              {currentGoal?.name ?? 'No goal selected'}
            </p>
          </div>
          <span className="rounded-full border border-white/12 bg-white/[0.07] px-2 py-1 text-[8px] font-semibold tracking-[0.12em] text-white/60 uppercase">
            {titleCase(telemetry.mission.status)}
          </span>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <p className="text-[20px] font-semibold tracking-[-0.04em] tabular-nums">
              {formatPercent(telemetry.mission.progress * 100)}
            </p>
            <p className="mt-0.5 text-[8.5px] tracking-[0.14em] text-white/35 uppercase">
              Route complete
            </p>
          </div>
          <div className="text-right">
            <p className="text-[11px] font-semibold tabular-nums">
              {currentEstimate?.distanceLabel ?? '—'}
            </p>
            <p className="mt-0.5 text-[8.5px] tracking-[0.14em] text-white/35 uppercase">
              Remaining
            </p>
          </div>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
          <motion.span
            className="bg-blush-200 block h-full rounded-full"
            animate={{ width: `${Math.max(2, telemetry.mission.progress * 100)}%` }}
            transition={{ type: 'spring', stiffness: 90, damping: 20 }}
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <p className="eyebrow text-steel-400">Choose destination</p>
          <span className="text-steel-400 text-[9px]">{floorplan.goals.length} zones</span>
        </div>
        <div className="mt-2 space-y-1.5">
          {floorplan.goals.map((goal) => {
            const isCurrent = telemetry.goal.id === goal.id;
            const estimate = estimateGoal(telemetry.robot.pose, goal);
            return (
              <button
                key={goal.id}
                type="button"
                onClick={() => void selectGoal(goal.id)}
                disabled={pending}
                className={cx(
                  'group flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition',
                  isCurrent
                    ? 'border-ink-900/10 bg-blush-100/60'
                    : 'border-ink-900/[0.06] hover:border-ink-900/12 bg-mist-50/50 hover:bg-mist-50',
                  pending && 'cursor-wait opacity-70',
                )}
              >
                <span
                  className={cx(
                    'grid size-7 shrink-0 place-items-center rounded-full',
                    isCurrent ? 'bg-ink-900 text-white' : 'bg-paper text-steel-500',
                  )}
                >
                  {isCurrent ? (
                    <Check className="size-3" aria-hidden />
                  ) : (
                    <MapPin className="size-3" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="text-ink-900 block text-[11.5px] font-semibold">
                    {goal.name}
                  </span>
                  <span className="text-steel-400 mt-0.5 block text-[9.5px]">
                    {estimate.distanceLabel} · {estimate.etaLabel}
                  </span>
                </span>
                <ChevronRight
                  className="text-steel-300 group-hover:text-ink-900 size-3.5 transition group-hover:translate-x-0.5"
                  aria-hidden
                />
              </button>
            );
          })}
        </div>
      </div>

      <div className="text-steel-500 flex gap-2 rounded-xl bg-mist-50 px-3.5 py-3 text-[9.5px] leading-relaxed">
        <Navigation className="text-steel-400 mt-[1px] size-3.5 shrink-0" aria-hidden />
        Routes are planned on the facility nav graph with A*, then streamed from the local
        simulator.
      </div>
    </div>
  );
}

function ActivityContent() {
  const telemetry = useDashboardStore((state) => state.telemetry);
  const history = useDashboardStore((state) => state.history);
  const connection = useDashboardStore((state) => state.connection);
  const lastMessageAt = useDashboardStore((state) => state.lastMessageAt);
  const goal = findGoal(telemetry.goal.id);
  const batteryHistory = history.map((point: HistoryPoint) => point.battery);
  const progressHistory = history.map((point: HistoryPoint) => point.progress * 100);

  const statusTone =
    telemetry.mission.status === 'estop'
      ? 'bg-alert-500'
      : telemetry.mission.status === 'paused'
        ? 'bg-safety-400'
        : 'bg-live-500';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-ink-900 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[8.5px] font-semibold tracking-[0.12em] text-white uppercase">
          <span className={cx('size-1.5 rounded-full', statusTone)} aria-hidden />
          {titleCase(telemetry.mission.status)}
        </span>
        <span className="border-ink-900/8 text-steel-500 inline-flex items-center gap-1.5 rounded-full border bg-mist-50 px-2.5 py-1.5 text-[8.5px] font-semibold tracking-[0.12em] uppercase">
          <Radio className="size-2.5" aria-hidden />
          {connectionLabel[connection]}
        </span>
        <span className="text-steel-400 ml-auto text-[9px] tabular-nums">
          {lastMessageAt ? formatClock(lastMessageAt) : '—'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          {
            label: 'Battery',
            value: `${Math.round(telemetry.health.battery)}%`,
            icon: BatteryMedium,
          },
          {
            label: 'Signal',
            value: titleCase(telemetry.health.signal),
            icon: Signal,
          },
          {
            label: 'Progress',
            value: formatPercent(telemetry.mission.progress * 100),
            icon: Gauge,
          },
          {
            label: 'Odometer',
            value: formatMeters(telemetry.robot.odometer),
            icon: Navigation,
          },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="border-ink-900/[0.06] rounded-xl border bg-mist-50/55 px-3 py-2.5"
            >
              <div className="text-steel-400 flex items-center gap-1.5">
                <Icon className="size-3" aria-hidden />
                <span className="eyebrow">{stat.label}</span>
              </div>
              <p className="text-ink-900 mt-1.5 text-[16px] font-semibold tracking-[-0.03em] tabular-nums">
                {stat.value}
              </p>
            </div>
          );
        })}
      </div>

      <Sparkline
        values={batteryHistory}
        color="#CE2431"
        label="Battery history"
        current={`${Math.round(telemetry.health.battery)}%`}
      />
      <Sparkline
        values={progressHistory}
        color="#23C55E"
        label="Route progress"
        current={formatPercent(telemetry.mission.progress * 100)}
      />

      <div className="border-ink-900/[0.06] bg-paper rounded-2xl border">
        <div className="border-ink-900/[0.05] border-b px-3.5 py-2.5">
          <p className="eyebrow text-steel-400">Mission record</p>
        </div>
        <dl className="divide-ink-900/[0.05] divide-y">
          {[
            ['Mission', `#${telemetry.mission.id}`],
            ['Goal', goal?.name ?? '—'],
            ['Elapsed', formatDuration(telemetry.mission.elapsedSeconds)],
            [
              'Waypoint',
              `${Math.min(telemetry.goal.waypointIndex + 1, Math.max(1, telemetry.goal.route.length))} / ${Math.max(1, telemetry.goal.route.length)}`,
            ],
            [
              'Pose',
              `${telemetry.robot.pose.x.toFixed(1)}, ${telemetry.robot.pose.z.toFixed(1)} m`,
            ],
            ['Heading', `${Math.round(headingDegrees(telemetry.robot.pose.heading))}°`],
            ['Mode', titleCase(telemetry.robot.mode)],
            ['Failsafe', telemetry.health.failsafe === 'okay' ? 'Okay' : 'Triggered'],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-3.5 py-2.5">
              <dt className="text-steel-400 text-[9.5px]">{label}</dt>
              <dd className="text-ink-900 text-[10px] font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="bg-live-500/[0.07] text-steel-500 flex items-start gap-2 rounded-xl px-3.5 py-3 text-[9.5px] leading-relaxed">
        <ShieldCheck className="text-live-600 mt-[1px] size-3.5 shrink-0" aria-hidden />
        Telemetry is streamed locally over SSE at 10 Hz. Charts sample once per second.
      </div>
    </div>
  );
}

function ProfileContent() {
  const telemetry = useDashboardStore((state) => state.telemetry);
  const connection = useDashboardStore((state) => state.connection);

  return (
    <div className="space-y-5">
      <div className="border-ink-900/[0.06] rounded-2xl border bg-[linear-gradient(135deg,#f8e5e7_0%,#f6f5f2_55%,#ecebe7_100%)] p-4">
        <div className="flex items-center gap-3.5">
          <span className="bg-ink-900 grid size-12 place-items-center rounded-full text-[15px] font-semibold text-white shadow-lg">
            AB
          </span>
          <div className="min-w-0">
            <p className="text-ink-900 text-[14px] font-semibold tracking-[-0.02em]">
              Aliasgar Bootwala
            </p>
            <p className="text-steel-500 mt-0.5 text-[10px]">Mission operator · Day shift</p>
          </div>
          <span className="border-live-500/20 bg-live-500/10 text-live-600 ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[8px] font-bold tracking-[0.1em] uppercase">
            <span className="bg-live-500 size-1.5 rounded-full" aria-hidden />
            Online
          </span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/55 px-3 py-2 backdrop-blur-sm">
            <p className="eyebrow text-steel-400">Facility</p>
            <p className="text-ink-900 mt-1 text-[10px] font-semibold">Bay 04 · East wing</p>
          </div>
          <div className="rounded-xl bg-white/55 px-3 py-2 backdrop-blur-sm">
            <p className="eyebrow text-steel-400">Link</p>
            <p className="text-ink-900 mt-1 text-[10px] font-semibold">
              {connectionLabel[connection]} · SSE
            </p>
          </div>
        </div>
      </div>

      <div className="border-ink-900/[0.06] bg-paper rounded-2xl border">
        <div className="border-ink-900/[0.05] flex items-center gap-2 border-b px-3.5 py-2.5">
          <Keyboard className="text-steel-400 size-3.5" aria-hidden />
          <p className="eyebrow text-steel-400">Keyboard controls</p>
        </div>
        <div className="divide-ink-900/[0.05] divide-y">
          {[
            ['Quick goal', ['Q']],
            ['Pause / resume', ['Space']],
            ['Toggle mode', ['M']],
            ['Swap camera / map', ['V']],
            ['Manual drive', ['W', 'A', 'S', 'D']],
            ['Close panel', ['Esc']],
          ].map(([label, keys]) => (
            <div key={label as string} className="flex items-center justify-between px-3.5 py-2.5">
              <span className="text-steel-500 text-[10px]">{label}</span>
              <span className="flex items-center gap-1">
                {(keys as string[]).map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="border-ink-900/[0.06] rounded-2xl border bg-mist-50/55 p-3.5">
        <div className="flex items-center gap-2">
          <CircleCheck className="text-live-600 size-3.5" aria-hidden />
          <p className="text-ink-900 text-[10px] font-semibold">Insight.IO · local build</p>
        </div>
        <p className="text-steel-500 mt-1.5 text-[9.5px] leading-relaxed">
          React 19 · Three.js point-cloud map · Fastify mission simulator. All telemetry stays on
          this machine.
        </p>
        <div className="border-ink-900/[0.06] text-steel-400 mt-3 flex items-center justify-between border-t pt-2.5 text-[8.5px] tracking-[0.12em] uppercase">
          <span>Mission {telemetry.mission.id}</span>
          <span>v1.0.0</span>
        </div>
      </div>
    </div>
  );
}

export function SidePanel({ commands }: SidePanelProps) {
  const drawer = useUiStore((state) => state.drawer);
  const setDrawer = useUiStore((state) => state.setDrawer);
  const [visibleDrawer, setVisibleDrawer] = useState<DrawerId | null>(drawer);

  if (drawer && drawer !== visibleDrawer) {
    setVisibleDrawer(drawer);
  }

  const meta = visibleDrawer ? drawerMeta[visibleDrawer] : null;
  const Icon = meta?.icon ?? MapPin;
  const close = () => setDrawer(null);

  return createPortal(
    <AnimatePresence>
      {drawer && (
        <div className="fixed inset-0 z-[60]" role="presentation">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-ink-950/20 absolute inset-0 backdrop-blur-[1px]"
            onClick={close}
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={meta?.title}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32, mass: 0.9 }}
            className="bg-paper shadow-panel absolute inset-y-0 right-0 flex w-[min(92vw,392px)] flex-col"
          >
            <div className="border-ink-900/[0.06] relative overflow-hidden border-b bg-[linear-gradient(135deg,#f8e5e7_0%,#fbfaf7_55%,#f6f5f2_100%)] px-6 pt-6 pb-4">
              <div
                className="bg-blush-300/20 pointer-events-none absolute -top-10 -right-8 size-32 rounded-full blur-2xl"
                aria-hidden
              />
              <div className="relative flex items-start justify-between gap-3">
                <div>
                  <div className="text-steel-500 flex items-center gap-2">
                    <Icon className="size-3.5" strokeWidth={1.8} aria-hidden />
                    <p className="eyebrow">{meta?.eyebrow}</p>
                  </div>
                  <h2 className="text-ink-900 mt-2 text-[22px] font-semibold tracking-[-0.035em]">
                    {meta?.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close panel"
                  className="icon-button bg-paper/70 text-steel-500 hover:bg-paper hover:text-ink-900 size-8 backdrop-blur"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {visibleDrawer === 'locations' && <LocationsContent commands={commands} />}
              {visibleDrawer === 'activity' && <ActivityContent />}
              {visibleDrawer === 'profile' && <ProfileContent />}
            </div>

            <div className="border-ink-900/[0.06] text-steel-400 flex items-center justify-between border-t bg-mist-50/60 px-5 py-3 text-[8.5px] tracking-[0.12em] uppercase">
              <span>Insight.IO</span>
              <span className="flex items-center gap-1.5">
                <span className="bg-live-500 size-1.5 rounded-full" aria-hidden />
                Local telemetry
              </span>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
