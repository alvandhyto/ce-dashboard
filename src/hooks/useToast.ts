import { useCallback, useEffect, useRef, useState } from "react";

export type ToastKind = "success" | "error" | "warning";

export interface ToastMessage {
    id: number;
    kind: ToastKind;
    message: string;
}

/**
 * One toast at a time; a new toast replaces the current one. Success toasts go away on
 * their own. Warnings and errors stay until dismissed, since they are lists to act on.
 */
export function useToast(durationMs = 5000) {
    const [toast, setToast] = useState<ToastMessage | null>(null);
    const timer = useRef<number | undefined>(undefined);

    const dismiss = useCallback(() => {
        window.clearTimeout(timer.current);
        setToast(null);
    }, []);

    const show = useCallback(
        (kind: ToastKind, message: string) => {
            window.clearTimeout(timer.current);
            setToast({ id: Date.now(), kind, message });
            if (kind === "success") {
                timer.current = window.setTimeout(() => setToast(null), durationMs);
            }
        },
        [durationMs],
    );

    useEffect(() => () => window.clearTimeout(timer.current), []);

    return { toast, show, dismiss };
}
