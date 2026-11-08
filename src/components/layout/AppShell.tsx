import { useRef, type MouseEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn";

interface AppShellProps {
    children: ReactNode;
    /** Lock the page to the viewport height on large screens, so inner panels scroll instead of the page. */
    fillViewport?: boolean;
}

/** Outermost frame of every page. The page background itself comes from <body> (index.css). */
export function AppShell({ children, fillViewport = false }: AppShellProps) {
    const shell = useRef<HTMLDivElement>(null);

    // Not a plain href="#main": the URL hash holds the route, so changing it would navigate away.
    const skipToMain = (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        const main = shell.current?.querySelector("main");
        if (!main) return;
        main.tabIndex = -1;
        main.focus();
    };

    return (
        <div
            ref={shell}
            className={cn(
                "flex min-h-screen flex-col font-sans text-slate-900 dark:text-slate-100",
                fillViewport && "lg:h-screen",
            )}
        >
            {/* Parked above the viewport until focused: the first Tab on any page brings it down. */}
            <a
                href="#main"
                onClick={skipToMain}
                className="fixed left-4 top-4 z-50 -translate-y-24 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white focus-visible:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:bg-slate-100 dark:text-slate-900"
            >
                Skip to Main Content
            </a>
            {children}
        </div>
    );
}
