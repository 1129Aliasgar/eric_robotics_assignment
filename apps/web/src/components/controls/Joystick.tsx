import { useCallback, useEffect, useRef, useState } from 'react';
import { Move } from 'lucide-react';
import type { DriveInput } from '../../hooks/useDriveController';
import { clamp, cx } from '../../lib/format';

type JoystickProps = {
  disabled: boolean;
  onDrive: (input: DriveInput) => void;
  onStop: () => void;
};

const KEY_MAP: Record<string, 'w' | 'a' | 's' | 'd'> = {
  KeyW: 'w',
  ArrowUp: 'w',
  KeyA: 'a',
  ArrowLeft: 'a',
  KeyS: 's',
  ArrowDown: 's',
  KeyD: 'd',
  ArrowRight: 'd',
};

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || target.isContentEditable;
}

export function Joystick({ disabled, onDrive, onStop }: JoystickProps) {
  const padRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<number | null>(null);
  const pressedRef = useRef(new Set<'w' | 'a' | 's' | 'd'>());
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [pressed, setPressed] = useState<Array<'w' | 'a' | 's' | 'd'>>([]);

  const emitFromKeys = useCallback(() => {
    const keys = pressedRef.current;
    const linear = (keys.has('w') ? 1 : 0) - (keys.has('s') ? 1 : 0);
    const angular = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
    setPressed(Array.from(keys));
    if (linear === 0 && angular === 0) {
      onStop();
    } else {
      onDrive({ linear, angular });
    }
  }, [onDrive, onStop]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (disabled || isTypingTarget(event.target)) return;
      const key = KEY_MAP[event.code];
      if (!key) return;
      event.preventDefault();
      if (pressedRef.current.has(key)) return;
      pressedRef.current.add(key);
      emitFromKeys();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = KEY_MAP[event.code];
      if (!key) return;
      if (!pressedRef.current.has(key)) return;
      event.preventDefault();
      pressedRef.current.delete(key);
      emitFromKeys();
    };

    const clear = () => {
      if (pressedRef.current.size === 0) return;
      pressedRef.current.clear();
      setPressed([]);
      onStop();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clear);
    };
  }, [disabled, emitFromKeys, onStop]);

  const updateFromPointer = (clientX: number, clientY: number) => {
    const pad = padRef.current;
    if (!pad) return;
    const rect = pad.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const max = rect.width * 0.225;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const distance = Math.hypot(dx, dy);
    if (distance > max) {
      dx = (dx / distance) * max;
      dy = (dy / distance) * max;
    }
    setOffset({ x: dx, y: dy });
    onDrive({
      linear: clamp(-dy / max, -1, 1),
      angular: clamp(dx / max, -1, 1),
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerRef.current = event.pointerId;
    setDragging(true);
    updateFromPointer(event.clientX, event.clientY);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current !== event.pointerId) return;
    updateFromPointer(event.clientX, event.clientY);
  };

  const release = (event: React.PointerEvent<HTMLDivElement>) => {
    if (pointerRef.current !== event.pointerId) return;
    pointerRef.current = null;
    setDragging(false);
    setOffset({ x: 0, y: 0 });
    onStop();
  };

  const directionActive = (direction: 'w' | 'a' | 's' | 'd') => {
    if (pressed.includes(direction)) return true;
    if (!dragging) return false;
    if (direction === 'w') return offset.y < -4;
    if (direction === 's') return offset.y > 4;
    if (direction === 'a') return offset.x < -4;
    return offset.x > 4;
  };

  return (
    <div className="flex flex-col items-center gap-1.5 select-none">
      <div
        ref={padRef}
        role="group"
        aria-label="Manual drive joystick. Drag, or use W A S D and arrow keys."
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        className={cx(
          'relative size-[104px] touch-none rounded-full bg-[radial-gradient(circle_at_34%_24%,#243446_0%,#111c29_72%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_22px_44px_-22px_rgba(13,20,31,0.6)] ring-1 ring-white/10 sm:size-[120px]',
          disabled ? 'cursor-not-allowed opacity-45' : 'cursor-grab active:cursor-grabbing',
        )}
      >
        <span
          className="absolute inset-[9%] rounded-full border border-white/[0.055]"
          aria-hidden
        />

        {(['w', 'a', 's', 'd'] as const).map((direction) => {
          const position =
            direction === 'w'
              ? 'left-1/2 top-2 -translate-x-1/2'
              : direction === 's'
                ? 'bottom-2 left-1/2 -translate-x-1/2'
                : direction === 'a'
                  ? 'left-2 top-1/2 -translate-y-1/2'
                  : 'right-2 top-1/2 -translate-y-1/2';
          return (
            <span
              key={direction}
              className={cx(
                'pointer-events-none absolute text-[8px] font-bold tracking-[0.1em] uppercase transition-colors',
                position,
                directionActive(direction) ? 'text-safety-400' : 'text-white/35',
              )}
              aria-hidden
            >
              {direction}
            </span>
          );
        })}

        <div
          className={cx(
            'absolute top-1/2 left-1/2 grid size-[62px] place-items-center rounded-full border border-white/80 bg-[radial-gradient(circle_at_36%_28%,#ffffff_0%,#eeece6_70%,#dedcd5_100%)] shadow-[0_12px_20px_-8px_rgba(0,0,0,0.45),inset_0_-2px_4px_rgba(13,20,31,0.12)] sm:size-[70px]',
            dragging ? 'scale-[0.98]' : 'transition-transform duration-300 ease-out',
          )}
          style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))` }}
        >
          <span className="text-ink-900/30 pointer-events-none flex flex-col items-center gap-1">
            <Move className="size-4" strokeWidth={1.8} aria-hidden />
            <span className="text-[6.5px] font-bold tracking-[0.16em]">DRIVE</span>
          </span>
        </div>
      </div>
      <span className="text-ink-900/55 text-[8px] font-bold tracking-[0.2em] uppercase">WASD</span>
    </div>
  );
}
