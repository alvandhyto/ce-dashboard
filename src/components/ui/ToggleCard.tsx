import { Check } from "lucide-react";
import { cn } from "../../lib/cn";

interface ToggleCardProps {
    label: string;
    description?: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}

/** Checkbox presented as a selectable card. Uses a real input, so Space/Tab/labels all work. */
export function ToggleCard({ label, description, checked, onChange, disabled = false }: ToggleCardProps) {
    return (
        <label
            className={cn(
                "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                checked
                    ? "border-slate-400 bg-slate-50 dark:border-slate-500 dark:bg-white/5"
                    : "border-slate-200 dark:border-white/10",
                disabled
                    ? "cursor-not-allowed opacity-70"
                    : "cursor-pointer hover:border-slate-300 dark:hover:border-slate-500",
            )}
        >
            <input
                type="checkbox"
                className="peer sr-only"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
            />
            <span
                aria-hidden
                className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                    "peer-focus-visible:ring-2 peer-focus-visible:ring-slate-400/60",
                    checked
                        ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                        : "border-slate-300 bg-white dark:border-slate-600 dark:bg-transparent",
                )}
            >
                {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
            </span>
            <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">{label}</span>
                {description ? (
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                        {description}
                    </span>
                ) : null}
            </span>
        </label>
    );
}
