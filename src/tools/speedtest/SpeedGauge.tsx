import { ACCENTS, type Accent } from "../../lib/accent";
import { cn } from "../../lib/cn";

interface SpeedGaugeProps {
    value: number;
    unit: string;
    caption: string;
    /** 0 to 100 */
    progress: number;
    clientIp?: string | null;
    accent?: Accent;
    /** Digits after the point. Latency is often below 10 ms, where whole numbers say little. */
    decimals?: number;
}

/** Circular readout. The ring is drawn with pathLength=100, so dash values are plain percentages. */
export function SpeedGauge({
    value,
    unit,
    caption,
    progress,
    clientIp,
    accent = "blue",
    decimals = 0,
}: SpeedGaugeProps) {
    return (
        <div className="relative h-64 w-64 md:h-72 md:w-72">
            <svg viewBox="0 0 100 100" aria-hidden className="h-full w-full -rotate-90">
                <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    strokeWidth="5"
                    className="stroke-slate-200 dark:stroke-white/10"
                />
                <circle
                    cx="50"
                    cy="50"
                    r="44"
                    fill="none"
                    strokeWidth="5"
                    strokeLinecap="round"
                    pathLength={100}
                    style={{ strokeDasharray: `${progress} 100` }}
                    className={cn(
                        ACCENTS[accent].stroke,
                        "transition-[stroke-dasharray] duration-300 ease-out motion-reduce:transition-none",
                    )}
                />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{caption}</span>
                <span className="mt-1 text-6xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {decimals > 0 ? value.toFixed(decimals) : Math.floor(value)}
                </span>
                <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">{unit}</span>
                {clientIp && (
                    <span className="mt-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                        {clientIp}
                    </span>
                )}
            </div>
        </div>
    );
}
