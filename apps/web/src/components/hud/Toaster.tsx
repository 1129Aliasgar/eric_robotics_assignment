import { AnimatePresence, motion } from 'motion/react';
import { CircleCheck, Info, ShieldAlert, TriangleAlert, X } from 'lucide-react';
import { useToastStore, type ToastTone } from '../../store/toastStore';
import { cx } from '../../lib/format';

const toneIcon: Record<ToastTone, typeof Info> = {
  info: Info,
  success: CircleCheck,
  warning: TriangleAlert,
  danger: ShieldAlert,
};

const toneColor: Record<ToastTone, string> = {
  info: 'text-white/70',
  success: 'text-live-500',
  warning: 'text-safety-400',
  danger: 'text-alert-500',
};

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  return (
    <div
      className="pointer-events-none fixed bottom-[calc(66px+env(safe-area-inset-bottom))] left-1/2 z-[90] flex w-[calc(100%-24px)] max-w-sm -translate-x-1/2 flex-col items-stretch gap-2 md:bottom-6"
      aria-live="polite"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const Icon = toneIcon[toast.tone];
          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 360, damping: 30 }}
              role={toast.tone === 'danger' ? 'alert' : 'status'}
              className="bg-ink-900/95 shadow-hud pointer-events-auto flex items-center gap-2.5 rounded-xl border border-white/10 px-3.5 py-2.5 text-white backdrop-blur-md"
            >
              <Icon className={cx('size-4 shrink-0', toneColor[toast.tone])} aria-hidden />
              <p className="min-w-0 flex-1 text-[11px] leading-snug font-medium text-white/90">
                {toast.message}
              </p>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                className="icon-button size-5 shrink-0 text-white/35 hover:bg-white/10 hover:text-white"
              >
                <X className="size-3" aria-hidden />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
