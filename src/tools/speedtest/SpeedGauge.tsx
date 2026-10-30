import { cn } from "../../lib/cn";

interface SpeedGaugeProps {
    caption: string;
    /** The big number, already formatted. */
    value: string;
    unit: string;
    /** Arc fill, 0 to 1. */
    progress: number;
    /** The scale's end, already formatted, printed at the end of the arc. None while there is no scale (latency). */
    scaleEnd?: string;
    /** Stroke classes for the arc, from SERIES. */
    stroke?: string;
}

/*
 * A 270° arc, open at the bottom, centred on (50, 50) in a 100-unit box. Both paths share
 * pathLength=100, so the fill's dash is a plain percentage of the arc.
 */
const ARC = "M 20.3 79.7 A 42 42 0 1 1 79.7 79.7";

/** Speedometer readout. The scale grows with the speed (model.ts scaleMax), so the arc stays readable at any speed. */
export function SpeedGauge({ caption, value, unit, progress, scaleEnd, stroke }: SpeedGaugeProps) {
    const fill = Math.min(1, Math.max(0, progress)) * 100;

    return (
        <div className="relative h-64 w-64 md:h-72 md:w-72">
            <svg viewBox="0 0 100 100" aria-hidden className="h-full w-full overflow-visible">
                <path
                    d={ARC}
                    fill="none"
                    strokeWidth="5"
                    strokeLinecap="round"
                    className="stroke-slate-200 dark:stroke-white/10"
                />
                <path
                    d={ARC}
                    fill="none"
                    strokeWidth="5"
                    strokeLinecap="round"
                    pathLength={100}
                    style={{ strokeDasharray: `${fill} 100`, opacity: fill > 0 ? 1 : 0 }}
                    className={cn(
                        stroke,
                        "transition-[stroke-dasharray,opacity] duration-300 ease-out motion-reduce:transition-none",
                    )}
                />
                {scaleEnd ? (
                    <g className="fill-slate-400 text-[4.5px] tabular-nums dark:fill-slate-500">
                        <text x="20.3" y="90" textAnchor="middle">
                            0
                        </text>
                        <text x="79.7" y="90" textAnchor="middle">
                            {scaleEnd}
                        </text>
                    </g>
                ) : null}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{caption}</span>
                <span className="mt-1 text-6xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {value}
                </span>
                <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">{unit}</span>
            </div>
        </div>
    );
}
