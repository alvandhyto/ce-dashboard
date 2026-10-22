import { ChevronDown } from "lucide-react";

interface SelectFieldProps<T extends string> {
    id: string;
    label: string;
    value: T;
    options: ReadonlyArray<{ value: T; label: string }>;
    onChange: (value: T) => void;
}

/** Native <select>: keyboard, screen-reader and mobile behaviour come for free. */
export function SelectField<T extends string>({ id, label, value, options, onChange }: SelectFieldProps<T>) {
    return (
        <div>
            <label
                htmlFor={id}
                className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400"
            >
                {label}
            </label>
            <div className="relative">
                <select
                    id={id}
                    value={value}
                    onChange={(event) => onChange(event.target.value as T)}
                    className="h-10 w-full cursor-pointer appearance-none rounded-lg border border-slate-300 bg-white pl-3 pr-9 text-sm text-slate-900 transition-colors focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-400/25 dark:border-white/15 dark:bg-[#0F1218] dark:text-slate-100 dark:[color-scheme:dark] dark:focus:border-slate-400"
                >
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
                <ChevronDown
                    aria-hidden
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                />
            </div>
        </div>
    );
}
