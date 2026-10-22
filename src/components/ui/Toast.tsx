import { AlertCircle, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { cn } from "../../lib/cn";
import type { ToastKind, ToastMessage } from "../../hooks/useToast";

const STYLES: Record<ToastKind, { box: string; Icon: typeof CheckCircle2 }> = {
    success: {
        box: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950 dark:text-emerald-100",
        Icon: CheckCircle2,
    },
    warning: {
        box: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-100",
        Icon: AlertTriangle,
    },
    error: {
        box: "border-red-200 bg-red-50 text-red-900 dark:border-red-500/30 dark:bg-red-950 dark:text-red-100",
        Icon: AlertCircle,
    },
};

interface ToastProps {
    toast: ToastMessage | null;
    onDismiss: () => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
    const reduceMotion = useReducedMotion();
    const tone = toast ? STYLES[toast.kind] : null;

    return (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
            <AnimatePresence>
                {toast && tone && (
                    <motion.div
                        key={toast.id}
                        role={toast.kind === "error" ? "alert" : "status"}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className={cn(
                            "pointer-events-auto flex max-w-md items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg",
                            tone.box,
                        )}
                    >
                        <tone.Icon className="mt-0.5 h-4 w-4 shrink-0" />
                        <p className="min-w-0 flex-1 whitespace-pre-line break-words">{toast.message}</p>
                        <button
                            type="button"
                            onClick={onDismiss}
                            aria-label="Dismiss"
                            className="-mr-1 shrink-0 cursor-pointer rounded p-0.5 opacity-60 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
