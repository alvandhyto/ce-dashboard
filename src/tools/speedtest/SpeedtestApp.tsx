import type { ReactNode } from "react";
import { Activity, Clock, Download, Upload } from "lucide-react";
import type { AppProps } from "../../core/types";
import { AppHeader } from "../../components/layout/AppHeader";
import { AppShell } from "../../components/layout/AppShell";
import { containerClass } from "../../components/layout/container";
import { Button } from "../../components/ui/Button";
import { StatTile } from "../../components/ui/StatTile";
import { cn } from "../../lib/cn";
import { formatMetric, gaugeProgress, STAGE_LABEL, type Results, type Stage } from "./model";
import { SpeedGauge } from "./SpeedGauge";
import { useSpeedtest } from "./useSpeedtest";

/** The four result tiles. Static, so they are built once and not on every poll. */
const TILES: ReadonlyArray<{ key: keyof Results; label: string; unit: string; icon: ReactNode; stage: Stage }> = [
    { key: "ping", label: "Latency", unit: "ms", icon: <Clock className="h-4 w-4" />, stage: "PING" },
    { key: "jitter", label: "Jitter", unit: "ms", icon: <Activity className="h-4 w-4" />, stage: "PING" },
    { key: "download", label: "Download", unit: "mbps", icon: <Download className="h-4 w-4" />, stage: "DOWNLOAD" },
    { key: "upload", label: "Upload", unit: "mbps", icon: <Upload className="h-4 w-4" />, stage: "UPLOAD" },
];

const HEADER_ICON = <img src="/icons/lintaslogo.png" alt="" className="h-8 w-8 shrink-0" />;

export default function SpeedtestApp({ onBack }: AppProps) {
    const { stage, results, value, running, warning, start, abort } = useSpeedtest();

    return (
        <AppShell>
            <AppHeader
                title="Speedtest"
                subtitle="Delivery Lintasarta"
                icon={HEADER_ICON}
                onBack={onBack}
                width="wide"
            />

            <main
                className={cn(
                    containerClass("narrow"),
                    "flex flex-1 flex-col items-center gap-8 justify-center",
                )}
            >
                <SpeedGauge
                    value={value}
                    unit={stage === "PING" ? "ms" : "Mbps"}
                    caption={STAGE_LABEL[stage]}
                    progress={gaugeProgress(stage, value)}
                    decimals={stage === "PING" ? 1 : 0}
                />

                <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
                    {TILES.map((tile) => (
                        <StatTile
                            key={tile.key}
                            label={tile.label}
                            value={formatMetric(results[tile.key])}
                            unit={tile.unit}
                            icon={tile.icon}
                            active={stage === tile.stage}
                        />
                    ))}
                </div>

                {warning ? (
                    <p
                        role="status"
                        className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-100"
                    >
                        {warning}
                    </p>
                ) : null}

                <Button
                    variant={running ? "danger" : "primary"}
                    accent="blue"
                    size="lg"
                    className="w-full"
                    onClick={running ? abort : start}
                >
                    {running
                        ? "CANCEL"
                        : stage === "COMPLETE"
                          ? "RE-TEST"
                          : "START"}
                </Button>
            </main>
        </AppShell>
    );
}
