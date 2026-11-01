'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AlertTriangleIcon, CheckIcon, CloseIcon, InfoIcon } from '@/components/icons';
import { cn } from '@/lib/cn';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastInput {
  tone: ToastTone;
  title: string;
  description?: string;
}

interface ToastEntry extends ToastInput {
  id: number;
}

interface ToastApi {
  notify: (toast: ToastInput) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** How long a success or info message stays. Errors stay until dismissed, so they cannot be missed. */
export const TOAST_DURATION_MS = 8_000;

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used inside <ToastProvider>.');
  return api;
}

const icons = { success: CheckIcon, error: AlertTriangleIcon, info: InfoIcon } as const;

/**
 * Feedback messages for the result of something the person just did. The viewport is a labelled
 * region; success and info messages are announced politely, errors assertively. Every message has
 * a dismiss button, and nothing here carries information that exists nowhere else.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (toast: ToastInput) => {
      const id = nextId.current++;
      setToasts((current) => [...current, { ...toast, id }]);
      if (toast.tone !== 'error') setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss],
  );

  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-end sm:px-6"
      >
        {/* Two live regions that always exist, so announcements are reliable when messages
            are added: polite for success and info, assertive for errors. */}
        <div role="status" className="flex w-full flex-col items-center gap-2 sm:items-end">
          {toasts
            .filter((toast) => toast.tone !== 'error')
            .map((toast) => (
              <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
            ))}
        </div>
        <div role="alert" className="flex w-full flex-col items-center gap-2 sm:items-end">
          {toasts
            .filter((toast) => toast.tone === 'error')
            .map((toast) => (
              <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
            ))}
        </div>
      </section>
    </ToastContext.Provider>
  );
}

function ToastCard({ toast, onDismiss }: { toast: ToastEntry; onDismiss: (id: number) => void }) {
  const Icon = icons[toast.tone];
  return (
    <div
      className={cn(
        'pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border px-4 py-3',
        toast.tone === 'error'
          ? 'border-danger-text/40 bg-danger-bg text-danger-text'
          : 'border-line-strong bg-surface text-ink',
      )}
    >
      <Icon width={20} height={20} className="mt-0.5 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-semibold">{toast.title}</p>
        {toast.description ? <p className="text-ui">{toast.description}</p> : null}
      </div>
      <button
        type="button"
        aria-label={`Dismiss: ${toast.title}`}
        onClick={() => onDismiss(toast.id)}
        className="-mt-1 -mr-2 inline-flex size-9 shrink-0 items-center justify-center rounded-md hover:bg-sunken"
      >
        <CloseIcon width={18} height={18} />
      </button>
    </div>
  );
}
