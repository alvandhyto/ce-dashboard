import { DASHBOARD_LAUNCHERS } from "../core/registry";
import type { Route } from "../core/types";
import { AppShell } from "../components/layout/AppShell";
import { AppHeader } from "../components/layout/AppHeader";
import { containerClass } from "../components/layout/container";
import { PageFooter } from "../components/layout/PageFooter";
import { AppCard } from "../components/launcher/AppCard";
import { EmptySlot } from "../components/launcher/EmptySlot";
import { LauncherGrid } from "../components/launcher/LauncherGrid";
import { cn } from "../lib/cn";

export function DashboardPage({ onOpen }: { onOpen: (route: Route) => void }) {
    return (
        <AppShell>
            <AppHeader
                title="Dashboard Delivery"
                subtitle="Hasil isengnya Dhyto"
            />

            <main
                className={cn(
                    containerClass(),
                    "flex-1 py-8 sm:py-10 justify-center flex flex-col gap-8",
                )}
            >
                <LauncherGrid>
                    {DASHBOARD_LAUNCHERS.map(({ key, route, ...card }) => (
                        <AppCard
                            key={key}
                            {...card}
                            onClick={() => onOpen(route)}
                        />
                    ))}
                    <EmptySlot label="Space for a future app" />
                </LauncherGrid>
            </main>

            <PageFooter>Developed by AVU</PageFooter>
        </AppShell>
    );
}
