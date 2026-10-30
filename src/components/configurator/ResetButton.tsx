import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "../../lib/cn";

const CONFIRM_WINDOW_MS = 3000;

/**
 * Reset that asks twice: the first click arms it, a second click within a few seconds
 * clears the form. One stray click can't wipe a long form. It stays the same <button>
 * throughout, so keyboard focus isn't lost when it arms. Looks like IconButton at rest.
 */
export function ResetButton({ onReset }: { onReset: () => void }) {
    const [armed, setArmed] = useState(false);

    useEffect(() => {
        if (!armed) return;
        const timer = window.setTimeout(() => setArmed(false), CONFIRM_WINDOW_MS);
        return () => window.clearTimeout(timer);
    }, [armed]);

    const handleClick = () => {
        if (!armed) return setArmed(true);
        setArmed(false);
        onReset();
    };

    const label = armed ? "Click again to clear the form" : "Reset";

    return (
        <button
            type="button"
            aria-label={label}
            title={label}
            onClick={handleClick}
            onBlur={() => setArmed(false)}
            className={cn(
                "inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border transition-colors",
                "focus-visible:outline-none focus-visible:ring-2",
                armed
                    ? "border-red-300 px-3 text-sm font-medium text-red-700 hover:bg-red-50 focus-visible:ring-red-500/40 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10"
                    : "w-9 border-slate-200 text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400/50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5",
            )}
        >
            <RotateCcw className="h-4 w-4" />
            {armed ? <span aria-hidden>Clear form?</span> : null}
        </button>
    );
}
