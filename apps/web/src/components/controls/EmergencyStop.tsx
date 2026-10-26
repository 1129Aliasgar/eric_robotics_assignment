import { LoaderCircle, Power } from 'lucide-react';
import { cx } from '../../lib/format';
import { Tooltip } from '../ui/Tooltip';

type EmergencyStopProps = {
  active: boolean;
  pending: boolean;
  onPress: () => void;
  onReset: () => void;
};

const starPoints = Array.from({ length: 40 }, (_, index) => {
  const angle = (index / 40) * Math.PI * 2 - Math.PI / 2;
  const radius = index % 2 === 0 ? 58 : 52;
  return `${60 + Math.cos(angle) * radius},${60 + Math.sin(angle) * radius}`;
}).join(' ');

export function EmergencyStop({ active, pending, onPress, onReset }: EmergencyStopProps) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Tooltip label={active ? 'Reset emergency stop' : 'Emergency stop'} side="left">
        <button
          type="button"
          onClick={active ? onReset : onPress}
          disabled={pending}
          aria-label={active ? 'Reset emergency stop' : 'Emergency stop'}
          aria-pressed={active}
          className={cx(
            'group relative grid size-[84px] place-items-center rounded-full transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98] sm:size-[100px]',
            active && 'animate-[pulse_1.6s_ease-in-out_infinite]',
            pending && 'cursor-wait opacity-80',
          )}
        >
          <span
            className={cx(
              'absolute inset-1 rounded-full blur-xl transition-colors',
              active ? 'bg-alert-500/30' : 'bg-safety-400/25',
            )}
            aria-hidden
          />
          <svg
            viewBox="0 0 120 120"
            className="relative size-full drop-shadow-[0_12px_20px_rgba(13,20,31,0.24)]"
          >
            <polygon
              points={starPoints}
              fill={active ? '#CE2431' : '#F3C312'}
              className="transition-colors duration-200"
            />
            <circle cx="60" cy="60" r="40" fill="#FFFFFD" />
            <circle
              cx="60"
              cy="60"
              r="35"
              fill="none"
              stroke={active ? '#FFFFFD' : '#CE2431'}
              strokeWidth="3.5"
              strokeDasharray="3 5"
              className="transition-colors duration-200"
            />
            <circle
              cx="60"
              cy="60"
              r="26"
              fill={active ? '#FFFFFD' : '#CE2431'}
              className="transition-colors duration-200"
            />
          </svg>
          <span className="absolute inset-0 grid place-items-center">
            {pending ? (
              <LoaderCircle className="text-alert-500 size-7 animate-spin" aria-hidden />
            ) : (
              <Power
                className={cx('size-7', active ? 'text-alert-500' : 'text-white')}
                strokeWidth={2.3}
                aria-hidden
              />
            )}
          </span>
        </button>
      </Tooltip>
      <span className="text-ink-900/55 text-[8px] font-bold tracking-[0.2em] uppercase">
        E-Stop
      </span>
    </div>
  );
}
