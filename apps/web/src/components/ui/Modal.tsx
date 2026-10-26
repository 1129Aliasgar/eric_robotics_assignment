import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
};

const focusableSelector =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  eyebrow,
  title,
  description,
  icon,
  children,
  footer,
  size = 'md',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    const target = panel?.querySelector<HTMLElement>(focusableSelector);
    target?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !panel) return;
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter(
        (element) => element.offsetParent !== null,
      );
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previous?.focus();
    };
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-6"
          role="presentation"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-ink-950/45 absolute inset-0 backdrop-blur-[3px]"
            onClick={onClose}
            aria-hidden
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? descriptionId : undefined}
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 28, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.99 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.85 }}
            className={`bg-paper shadow-panel relative z-10 max-h-[92dvh] w-full overflow-hidden rounded-t-[28px] sm:rounded-[26px] ${
              size === 'lg' ? 'sm:max-w-[620px]' : 'sm:max-w-[520px]'
            }`}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-5 sm:px-7 sm:pt-7">
              <div className="flex min-w-0 items-start gap-3.5">
                {icon && (
                  <span className="bg-blush-100 text-ink-900 mt-0.5 grid size-10 shrink-0 place-items-center rounded-full">
                    {icon}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="eyebrow text-steel-400">{eyebrow}</p>
                  <h2
                    id={titleId}
                    className="text-ink-900 mt-1.5 text-[21px] leading-tight font-semibold tracking-[-0.03em]"
                  >
                    {title}
                  </h2>
                  {description && (
                    <p
                      id={descriptionId}
                      className="text-steel-500 mt-1.5 max-w-md text-[12px] leading-relaxed"
                    >
                      {description}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="icon-button text-steel-500 hover:text-ink-900 size-8 shrink-0 bg-mist-50 hover:bg-mist-100"
                aria-label="Close dialog"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div className="max-h-[58dvh] overflow-y-auto px-6 sm:px-7">{children}</div>

            {footer && (
              <div className="border-ink-900/[0.07] flex items-center justify-end gap-2 border-t bg-mist-50/70 px-6 py-4 sm:px-7">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
