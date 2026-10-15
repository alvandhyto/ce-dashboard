import { cn } from "../../lib/cn";

interface TextFieldProps {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    error?: string;
    /** "password" masks the input. Defaults to "text". */
    type?: "text" | "password";
    autoFocus?: boolean;
    className?: string;
}

export function TextField({
    id,
    label,
    value,
    onChange,
    placeholder,
    error,
    type = "text",
    autoFocus,
    className,
}: TextFieldProps) {
    const errorId = `${id}-error`;

    return (
        <div className={className}>
            <label
                htmlFor={id}
                className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400"
            >
                {label}
            </label>
            <input
                id={id}
                type={type}
                autoFocus={autoFocus}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? errorId : undefined}
                className={cn(
                    "h-10 w-full rounded-lg border bg-white px-3 text-sm text-slate-900 transition-colors",
                    "placeholder:text-slate-400 focus:outline-none focus:ring-2",
                    "dark:bg-[#0F1218] dark:text-slate-100 dark:placeholder:text-slate-600",
                    error
                        ? "border-red-500 focus:ring-red-500/25"
                        : "border-slate-300 focus:border-slate-500 focus:ring-slate-400/25 dark:border-white/15 dark:focus:border-slate-400",
                )}
            />
            {error && (
                <p id={errorId} className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}
        </div>
    );
}
