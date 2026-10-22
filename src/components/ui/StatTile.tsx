import type { ReactNode } from "react";
import { ACCENTS, type Accent } from "../../lib/accent";
import { cn } from "../../lib/cn";

interface StatTileProps {
    label: string;
    value: string;
    unit?: string;
    icon?: ReactNode;
    /** Highlights the tile, e.g. while its metric is being measured. */
    active?: boolean;
    accent?: Accent;
}

export function StatTile({ label, value, unit, icon, active = false, accent = "blue" }: StatTileProps) {
    return (
        <div
            className={cn(
                "rounded-xl border p-4 transition-colors",
                active
                    ? ACCENTS[accent].activeCard
                    : "border-slate-200 bg-white dark:border-white/10 dark:bg-[#151A22]",
            )}
        >
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                {icon && <span className={cn(active && ACCENTS[accent].text)}>{icon}</span>}
                {label}
            </div>
            <p className="mt-3 flex items-baseline gap-1">
                <span className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
                    {value}
                </span>
                {unit && <span className="text-xs text-slate-500 dark:text-slate-400">{unit}</span>}
            </p>
        </div>
    );
}
