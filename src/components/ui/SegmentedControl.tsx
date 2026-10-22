import { cn } from "../../lib/cn";

interface SegmentedControlProps<T extends string> {
    /** Groups the radio inputs. Must be unique on the page. */
    id: string;
    label: string;
    /** Keep the label for screen readers only. For controls whose meaning is obvious from context. */
    hideLabel?: boolean;
    value: T;
    options: ReadonlyArray<{ value: T; label: string }>;
    onChange: (value: T) => void;
}

/**
 * Pill with two or three mutually exclusive choices, e.g. Static / DHCP.
 * Built on real radio inputs, so arrow keys, Tab and screen readers work.
 */
export function SegmentedControl<T extends string>({
    id,
    label,
    hideLabel = false,
    value,
    options,
    onChange,
}: SegmentedControlProps<T>) {
    return (
        <fieldset>
            <legend
                className={cn(
                    "text-xs font-medium text-slate-600 dark:text-slate-400",
                    hideLabel ? "sr-only" : "mb-1.5",
                )}
            >
                {label}
            </legend>
            <div className="grid h-10 grid-flow-col auto-cols-fr gap-0.5 rounded-lg border border-slate-300 bg-slate-100 p-0.5 dark:border-white/15 dark:bg-[#0F1218]">
                {options.map((option) => (
                    <label key={option.value} className="flex">
                        <input
                            type="radio"
                            id={id}
                            value={option.value}
                            checked={value === option.value}
                            onChange={() => onChange(option.value)}
                            className="peer sr-only"
                        />
                        <span
                            className={cn(
                                "flex h-full w-full cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-colors",
                                "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
                                "peer-checked:bg-white peer-checked:text-slate-900 peer-checked:shadow-sm",
                                "dark:peer-checked:bg-white/10 dark:peer-checked:text-slate-100",
                                "peer-focus-visible:ring-2 peer-focus-visible:ring-slate-400/60",
                            )}
                        >
                            {option.label}
                        </span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}
