import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ACCENTS, type Accent } from "../../lib/accent";
import { cn } from "../../lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const BASE =
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg font-medium transition-colors " +
    "focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed";

const PRIMARY_DISABLED =
    "disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-white/10 dark:disabled:text-slate-500";

const VARIANTS: Record<Exclude<Variant, "primary">, string> = {
    secondary:
        "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400/50 " +
        "dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10 " +
        "disabled:opacity-50",
    ghost:
        "text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400/50 " +
        "dark:text-slate-300 dark:hover:bg-white/5 disabled:opacity-50",
    danger:
        "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/50 " +
        PRIMARY_DISABLED,
};

const SIZES: Record<Size, string> = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-3.5 text-sm",
    lg: "h-11 px-5 text-sm",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: Variant;
    /** Colour of the primary variant. Defaults to the generator rose. */
    accent?: Accent;
    size?: Size;
    icon?: ReactNode;
    loading?: boolean;
}

export function Button({
    variant = "secondary",
    accent = "rose",
    size = "md",
    icon,
    loading = false,
    type = "button",
    disabled,
    className,
    children,
    ...rest
}: ButtonProps) {
    const variantClass =
        variant === "primary"
            ? `${ACCENTS[accent].solid} ${PRIMARY_DISABLED}`
            : VARIANTS[variant];

    return (
        <button
            type={type}
            disabled={disabled || loading}
            className={cn(BASE, variantClass, SIZES[size], className)}
            {...rest}
        >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
            {children}
        </button>
    );
}

interface IconButtonProps extends Omit<
    ButtonHTMLAttributes<HTMLButtonElement>,
    "children" | "aria-label"
> {
    /** Accessible name, also shown as the tooltip. */
    label: string;
    children: ReactNode;
}

export function IconButton({
    label,
    className,
    type = "button",
    children,
    ...rest
}: IconButtonProps) {
    return (
        <button
            type={type}
            aria-label={label}
            title={label}
            className={cn(
                "inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition-colors",
                "hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/50",
                "dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5",
                className,
            )}
            {...rest}
        >
            {children}
        </button>
    );
}
