import { GENERATOR_LAUNCHERS } from "../core/registry";
import type { Route } from "../core/types";
import { AppShell } from "../components/layout/AppShell";
import { AppHeader } from "../components/layout/AppHeader";
import { containerClass } from "../components/layout/container";
import { PageFooter } from "../components/layout/PageFooter";
import { AppCard } from "../components/launcher/AppCard";
import { EmptySlot } from "../components/launcher/EmptySlot";
import { LauncherGrid } from "../components/launcher/LauncherGrid";
import { cn } from "../lib/cn";

interface GeneratorsPageProps {
    onOpen: (route: Route) => void;
    onBack: () => void;
}

export function GeneratorsPage({ onOpen, onBack }: GeneratorsPageProps) {
    return (
        <AppShell>
            <AppHeader
                title="Generators"
                subtitle="Standardized configuration generators for various projects"
                onBack={onBack}
            />

            <main className={cn(containerClass(), "flex-1 py-8 sm:py-10")}>
                <LauncherGrid>
                    {GENERATOR_LAUNCHERS.map(({ key, route, ...card }) => (
                        <AppCard
                            key={key}
                            {...card}
                            onClick={() => onOpen(route)}
                        />
                    ))}
                    <EmptySlot label="Space for a future generator" />
                </LauncherGrid>
            </main>

            <PageFooter>Developed by AVU</PageFooter>
        </AppShell>
    );
}
