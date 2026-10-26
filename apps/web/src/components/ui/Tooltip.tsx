import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';

type Side = 'top' | 'right' | 'bottom' | 'left';

type TooltipProps = {
  label: string;
  children: ReactNode;
  side?: Side;
  disabled?: boolean;
  className?: string;
};

type Position = {
  top: number;
  left: number;
  transform: string;
};

function positionFor(rect: DOMRect, side: Side): Position {
  const gap = 9;
  switch (side) {
    case 'right':
      return {
        top: rect.top + rect.height / 2,
        left: rect.right + gap,
        transform: 'translateY(-50%)',
      };
    case 'left':
      return {
        top: rect.top + rect.height / 2,
        left: rect.left - gap,
        transform: 'translate(-100%, -50%)',
      };
    case 'bottom':
      return {
        top: rect.bottom + gap,
        left: rect.left + rect.width / 2,
        transform: 'translateX(-50%)',
      };
    case 'top':
    default:
      return {
        top: rect.top - gap,
        left: rect.left + rect.width / 2,
        transform: 'translate(-50%, -100%)',
      };
  }
}

export function Tooltip({ label, children, side = 'top', disabled, className }: TooltipProps) {
  const id = useId();
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);

  const updatePosition = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition(positionFor(rect, side));
  }, [side]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

  if (disabled) return <>{children}</>;

  return (
    <>
      <span
        ref={anchorRef}
        className={className ?? 'inline-flex'}
        onPointerEnter={() => setOpen(true)}
        onPointerLeave={() => setOpen(false)}
        onFocusCapture={() => setOpen(true)}
        onBlurCapture={() => setOpen(false)}
        onPointerDown={() => setOpen(false)}
        aria-describedby={open ? id : undefined}
      >
        {children}
      </span>
      {createPortal(
        <AnimatePresence>
          {open && position && (
            <motion.span
              id={id}
              role="tooltip"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.12 }}
              style={{
                position: 'fixed',
                top: position.top,
                left: position.left,
                transform: position.transform,
                zIndex: 95,
              }}
              className="bg-ink-900 shadow-hud pointer-events-none hidden rounded-lg px-2.5 py-1.5 text-[10px] font-medium tracking-[0.01em] whitespace-nowrap text-white md:block"
            >
              {label}
            </motion.span>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}
