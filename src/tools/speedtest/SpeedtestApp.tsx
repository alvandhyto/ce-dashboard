import { Activity, Clock, Download, Upload } from "lucide-react";
import type { AppProps } from "../../core/types";
import { AppHeader } from "../../components/layout/AppHeader";
import { AppShell } from "../../components/layout/AppShell";
import { containerClass } from "../../components/layout/container";
import { Button } from "../../components/ui/Button";
import { StatTile } from "../../components/ui/StatTile";
import { cn } from "../../lib/cn";
import { formatMetric, gaugeProgress, isRunning, STAGE_LABEL } from "./model";
import { SpeedGauge } from "./SpeedGauge";
import { useSpeedtest } from "./useSpeedtest";

export default function SpeedtestApp({ onBack }: AppProps) {
    const { stage, results, displayValue, clientIp, start, abort } =
        useSpeedtest();
    const running = isRunning(stage);

    const tiles = [
        {
            label: "Latency",
            value: results.ping,
            unit: "ms",
            icon: <Clock className="h-4 w-4" />,
            active: stage === "PING",
        },
        {
            label: "Jitter",
            value: results.jitter,
            unit: "ms",
            icon: <Activity className="h-4 w-4" />,
            active: stage === "PING",
        },
        {
            label: "Download",
            value: results.download,
            unit: "mbps",
            icon: <Download className="h-4 w-4" />,
            active: stage === "DOWNLOAD",
        },
        {
            label: "Upload",
            value: results.upload,
            unit: "mbps",
            icon: <Upload className="h-4 w-4" />,
            active: stage === "UPLOAD",
        },
    ];

    return (
        <AppShell>
            <AppHeader
                title="Speedtest"
                subtitle="Delivery Lintasarta"
                icon={
                    <img
                        src="/icons/lintaslogo.png"
                        alt=""
                        className="h-8 w-8 shrink-0"
                    />
                }
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
                    value={displayValue}
                    unit={stage === "PING" ? "ms" : "mbps"}
                    caption={STAGE_LABEL[stage]}
                    progress={gaugeProgress(stage, displayValue)}
                    clientIp={clientIp}
                />

                <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
                    {tiles.map((tile) => (
                        <StatTile
                            key={tile.label}
                            label={tile.label}
                            value={formatMetric(tile.value)}
                            unit={tile.unit}
                            icon={tile.icon}
                            active={tile.active}
                        />
                    ))}
                </div>

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
                          ? "TEST AGAIN"
                          : "START SPEEDTEST"}
                </Button>
            </main>
        </AppShell>
    );
}
