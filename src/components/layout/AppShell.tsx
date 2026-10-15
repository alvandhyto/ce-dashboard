import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

interface AppShellProps {
    children: ReactNode;
    /** Lock the page to the viewport height on large screens, so inner panels scroll instead of the page. */
    fillViewport?: boolean;
}

/** Outermost frame of every page. The page background itself comes from <body> (index.css). */
export function AppShell({ children, fillViewport = false }: AppShellProps) {
    return (
        <div
            className={cn(
                "flex min-h-screen flex-col font-sans text-slate-900 dark:text-slate-100",
                fillViewport && "lg:h-screen",
            )}
        >
            {children}
        </div>
    );
}
