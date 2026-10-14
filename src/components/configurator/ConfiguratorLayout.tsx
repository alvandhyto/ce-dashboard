import type { ReactNode } from "react";

interface ConfiguratorLayoutProps {
    header: ReactNode;
    /** Left column: parameters. */
    sidebar: ReactNode;
    /** Right column: generated output. */
    main: ReactNode;
}

/**
 * Page frame shared by every configurator.
 * On large screens it fills the viewport and each column scrolls on its own;
 * on small screens the columns stack and the page scrolls.
 */
export function ConfiguratorLayout({ header, sidebar, main }: ConfiguratorLayoutProps) {
    return (
        <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900 dark:bg-[#0F1218] dark:text-slate-100 lg:h-screen">
            {header}
            <main className="mx-auto grid min-h-0 w-full max-w-7xl flex-1 gap-6 p-4 sm:p-6 lg:grid-cols-[440px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]">
                <div className="flex min-h-0 flex-col">{sidebar}</div>
                <div className="flex h-[60vh] min-h-[360px] flex-col lg:h-auto">{main}</div>
            </main>
        </div>
    );
}
