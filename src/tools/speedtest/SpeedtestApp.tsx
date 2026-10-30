import type { ReactNode } from "react";
import { Activity, Clock, Download, Upload } from "lucide-react";
import type { AppProps } from "../../core/types";
import { AppHeader } from "../../components/layout/AppHeader";
import { AppShell } from "../../components/layout/AppShell";
import { containerClass } from "../../components/layout/container";
import { Button } from "../../components/ui/Button";
import { StatTile } from "../../components/ui/StatTile";
import { cn } from "../../lib/cn";
import type { Accent } from "../../lib/accent";
import {
    formatMetric,
    formatThroughput,
    formatScale,
    formatSpeed,
    peakOf,
    scaleMax,
    speedUnit,
    STAGE_LABEL,
    type Direction,
    type Results,
    type SpeedtestView,
    type Stage,
} from "./model";
import { SERIES } from "./series";
import { SpeedChart } from "./SpeedChart";
import { SpeedGauge } from "./SpeedGauge";
import { useSpeedtest } from "./useSpeedtest";

/** The four result tiles. Static, so they are built once and not on every poll. */
const TILES: ReadonlyArray<{
    key: keyof Results;
    label: string;
    unit: string;
    icon: ReactNode;
    stage: Stage;
    accent: Accent;
}> = [
    { key: "ping", label: "Latency", unit: "ms", icon: <Clock className="h-4 w-4" />, stage: "PING", accent: "blue" },
    { key: "jitter", label: "Jitter", unit: "ms", icon: <Activity className="h-4 w-4" />, stage: "PING", accent: "blue" },
    {
        key: "download",
        label: "Download",
        unit: "Mbps",
        icon: <Download className="h-4 w-4" />,
        stage: "DOWNLOAD",
        accent: SERIES.download.accent,
    },
    {
        key: "upload",
        label: "Upload",
        unit: "Mbps",
        icon: <Upload className="h-4 w-4" />,
        stage: "UPLOAD",
        accent: SERIES.upload.accent,
    },
];

/** Latency and jitter in ms as they are; speeds switch to Gbps from 1000 Mbps. */
const tileValue = (key: keyof Results, value: number, unit: string) =>
    key === "download" || key === "upload" ? formatThroughput(value) : { value: formatMetric(value), unit };

/** The throughput test a stage shows on the gauge: the one running, or the last one once done. */
const directionOf = (stage: Stage): Direction | null =>
    stage === "DOWNLOAD" ? "download" : stage === "UPLOAD" || stage === "COMPLETE" ? "upload" : null;

/** What the gauge shows. Throughput gets a scale that grows with the fastest reading of its test. */
function gaugeFor({ stage, value, samples }: SpeedtestView) {
    const caption = STAGE_LABEL[stage];
    const direction = directionOf(stage);
    if (!direction) {
        return stage === "PING"
            ? { caption, value: value.toFixed(1), unit: "ms", progress: 0 }
            : { caption, value: "0", unit: "Mbps", progress: 0 };
    }
    const scale = scaleMax(Math.max(peakOf(samples[direction]), value));
    const unit = speedUnit(scale);
    return {
        caption,
        value: formatSpeed(value, unit),
        unit,
        progress: value / scale,
        scaleEnd: formatScale(scale, unit),
        stroke: SERIES[direction].stroke,
    };
}

const HEADER_ICON = <img src="/icons/lintaslogo.png" alt="" className="h-8 w-8 shrink-0" />;

export default function SpeedtestApp({ onBack }: AppProps) {
    const { running, warning, start, abort, ...view } = useSpeedtest();
    const { stage, results, samples } = view;
    const live = stage === "DOWNLOAD" || stage === "UPLOAD" ? directionOf(stage) : null;

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
                <SpeedGauge {...gaugeFor(view)} />

                <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
                    {TILES.map((tile) => (
                        <StatTile
                            key={tile.key}
                            label={tile.label}
                            {...tileValue(tile.key, results[tile.key], tile.unit)}
                            icon={tile.icon}
                            active={stage === tile.stage}
                            accent={tile.accent}
                        />
                    ))}
                </div>

                <SpeedChart samples={samples} live={live} />

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
