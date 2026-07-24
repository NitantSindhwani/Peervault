'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, Warning, Info, X } from '@phosphor-icons/react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'warning' | 'info';
  title: string;
  description?: string;
}

export interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-[var(--success)] shrink-0" weight="fill" />,
    warning: <Warning className="w-5 h-5 text-[var(--accent)] shrink-0" weight="fill" />,
    info: <Info className="w-5 h-5 text-[var(--accent)] shrink-0" weight="fill" />,
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="pointer-events-auto bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-xl p-4 shadow-2xl flex items-start gap-3 text-xs font-mono"
    >
      {icons[toast.type]}
      <div className="flex-1 space-y-0.5">
        <h4 className="font-bold text-[var(--text-primary)]">{toast.title}</h4>
        {toast.description && <p className="text-[var(--text-secondary)]">{toast.description}</p>}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
        aria-label="Dismiss notification"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
