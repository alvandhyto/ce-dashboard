import { useCallback, useEffect, useRef, useState } from "react";
import { copyText } from "../lib/clipboard";

export type CopyStatus = "idle" | "copied" | "failed";

/** Copy helper that exposes a short-lived status, so the button itself can confirm the action. */
export function useCopyToClipboard(resetAfterMs = 2000) {
    const [status, setStatus] = useState<CopyStatus>("idle");
    const timer = useRef<number | undefined>(undefined);

    const copy = useCallback(
        async (text: string) => {
            const ok = await copyText(text);
            setStatus(ok ? "copied" : "failed");
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => setStatus("idle"), resetAfterMs);
        },
        [resetAfterMs],
    );

    useEffect(() => () => window.clearTimeout(timer.current), []);

    return { status, copy };
}
