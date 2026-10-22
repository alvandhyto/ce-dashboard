import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { AppShell } from "../layout/AppShell";
import { containerClass } from "../layout/container";

interface ConfiguratorLayoutProps {
    /** Usually an <AppHeader width="wide" />. */
    header: ReactNode;
    /** Left column: parameters. */
    sidebar: ReactNode;
    /** Right column: generated output. */
    main: ReactNode;
}

/**
 * Two-column page used by every configurator.
 * On large screens it fills the viewport and each column scrolls on its own;
 * on small screens the columns stack and the page scrolls.
 */
export function ConfiguratorLayout({ header, sidebar, main }: ConfiguratorLayoutProps) {
    return (
        <AppShell fillViewport>
            {header}
            <main
                className={cn(
                    containerClass("wide"),
                    "grid min-h-0 flex-1 gap-6 py-4 sm:py-6 lg:grid-cols-[440px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]",
                )}
            >
                <div className="flex min-h-0 flex-col">{sidebar}</div>
                <div className="flex h-[60vh] min-h-[360px] flex-col lg:h-auto">{main}</div>
            </main>
        </AppShell>
    );
}
