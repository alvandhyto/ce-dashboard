import { useCallback, useEffect, useRef, useState } from "react";

export type ToastKind = "success" | "error" | "warning";

export interface ToastMessage {
    id: number;
    kind: ToastKind;
    message: string;
}

/** One toast at a time, auto-dismissed. A new toast replaces the current one. */
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
            timer.current = window.setTimeout(() => setToast(null), durationMs);
        },
        [durationMs],
    );

    useEffect(() => () => window.clearTimeout(timer.current), []);

    return { toast, show, dismiss };
}
