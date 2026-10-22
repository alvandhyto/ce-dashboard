import { ChevronRight, Lock } from "lucide-react";
import type { ReactNode } from "react";
import type { Accent } from "../../lib/accent";
import { AppIcon } from "../ui/AppIcon";

export interface AppCardProps {
    title: string;
    description: string;
    icon: ReactNode;
    accent: Accent;
    /** Shows a lock badge for destinations behind the access gate. */
    restricted?: boolean;
    onClick: () => void;
}

/** Launcher tile for the dashboard and the generator menu. The whole card is one button. */
export function AppCard({
    title,
    description,
    icon,
    accent,
    restricted,
    onClick,
}: AppCardProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="group flex h-full w-full cursor-pointer flex-col items-start rounded-xl border border-slate-200 bg-white p-6 text-left transition-colors hover:border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50 dark:border-white/10 dark:bg-[#151A22] dark:hover:border-white/25"
        >
            <div className="flex w-full items-start justify-between gap-3">
                <AppIcon accent={accent}>{icon}</AppIcon>
                {restricted && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <Lock className="h-3.5 w-3.5" />
                        Restricted
                    </span>
                )}
            </div>

            <h2 className="mt-5 text-lg font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-tight">
                {title}
            </h2>
            <p className="mt-1.5 flex-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                {description}
            </p>

            <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                Open
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
        </button>
    );
}
