import { useRef } from 'react';
import { Minus, Plus } from 'lucide-react';
import { clamp, cx } from '../../lib/format';

type ZoomSliderProps = {
  value: number;
  min: number;
  max: number;
  label: string;
  onChange: (value: number) => void;
  className?: string;
};

export function ZoomSlider({ value, min, max, label, onChange, className }: ZoomSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const captureRef = useRef<number | null>(null);
  const percent = ((value - min) / (max - min)) * 100;

  const setFromPointer = (clientY: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const ratio = 1 - clamp((clientY - rect.top) / rect.height, 0, 1);
    onChange(min + ratio * (max - min));
  };

  const step = (direction: 1 | -1) => {
    onChange(clamp(value + direction * 0.18, min, max));
  };

  return (
    <div className={cx('flex flex-col items-center gap-1.5', className)}>
      <button
        type="button"
        onClick={() => step(1)}
        aria-label={`Zoom ${label} in`}
        className="icon-button bg-paper/85 text-ink-900 hover:bg-paper size-6 shadow-sm backdrop-blur-md"
      >
        <Plus className="size-3" strokeWidth={2} aria-hidden />
      </button>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={`${label} zoom`}
        aria-orientation="vertical"
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Number(value.toFixed(2))}
        aria-valuetext={`${Math.round(percent)} percent`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          captureRef.current = event.pointerId;
          setFromPointer(event.clientY);
        }}
        onPointerMove={(event) => {
          if (captureRef.current === event.pointerId) setFromPointer(event.clientY);
        }}
        onPointerUp={(event) => {
          if (captureRef.current === event.pointerId) {
            captureRef.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowRight') {
            event.preventDefault();
            step(1);
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') {
            event.preventDefault();
            step(-1);
          }
          if (event.key === 'Home') {
            event.preventDefault();
            onChange(max);
          }
          if (event.key === 'End') {
            event.preventDefault();
            onChange(min);
          }
        }}
        className="group relative flex h-24 w-7 cursor-pointer touch-none items-center justify-center"
      >
        <span className="bg-ink-900/25 absolute inset-y-2 left-1/2 w-[2px] -translate-x-1/2 rounded-full" />
        <span
          className="bg-ink-900/70 absolute left-1/2 w-[2px] -translate-x-1/2 rounded-full"
          style={{ bottom: '50%', height: `${Math.max(0, percent - 50)}%` }}
        />
        <span
          className="bg-ink-900 absolute left-1/2 size-[9px] -translate-x-1/2 translate-y-1/2 rounded-full border border-white shadow-sm transition-transform group-hover:scale-125"
          style={{ bottom: `${percent}%` }}
        />
      </div>

      <button
        type="button"
        onClick={() => step(-1)}
        aria-label={`Zoom ${label} out`}
        className="icon-button bg-paper/85 text-ink-900 hover:bg-paper size-6 shadow-sm backdrop-blur-md"
      >
        <Minus className="size-3" strokeWidth={2} aria-hidden />
      </button>
    </div>
  );
}
