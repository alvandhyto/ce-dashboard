import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface PanelProps {
    title?: ReactNode;
    /** Controls on the right side of the header. */
    actions?: ReactNode;
    footer?: ReactNode;
    children: ReactNode;
    className?: string;
    bodyClassName?: string;
    footerClassName?: string;
}

/** Bordered surface with an optional header and footer. The body scrolls; header and footer stay put. */
export function Panel({
    title,
    actions,
    footer,
    children,
    className,
    bodyClassName,
    footerClassName,
}: PanelProps) {
    return (
        <section
            className={cn(
                "flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white",
                "dark:border-white/10 dark:bg-[#151A22]",
                className,
            )}
        >
            {(title || actions) && (
                <header className="flex min-h-[3.25rem] items-center justify-between gap-3 border-b border-slate-200 px-5 dark:border-white/10">
                    <h2 className="min-w-0 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {title}
                    </h2>
                    {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
                </header>
            )}

            <div className={cn("custom-scrollbar min-h-0 flex-1 overflow-y-auto", bodyClassName)}>
                {children}
            </div>

            {footer && (
                <footer
                    className={cn(
                        "border-t border-slate-200 px-5 py-4 dark:border-white/10",
                        footerClassName,
                    )}
                >
                    {footer}
                </footer>
            )}
        </section>
    );
}
