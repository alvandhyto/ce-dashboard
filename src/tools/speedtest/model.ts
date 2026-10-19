import type { SpeedtestData } from "./speedtest";

export type Stage = "IDLE" | "PING" | "DOWNLOAD" | "UPLOAD" | "COMPLETE";

export interface Results {
    ping: number;
    jitter: number;
    download: number;
    upload: number;
}

export const EMPTY_RESULTS: Results = { ping: 0, jitter: 0, download: 0, upload: 0 };

/** Speed at which the gauge ring is full. */
export const GAUGE_MAX_MBPS = 600;

export const STAGE_LABEL: Record<Stage, string> = {
    IDLE: "Ready",
    PING: "Latency",
    DOWNLOAD: "Download",
    UPLOAD: "Upload",
    COMPLETE: "Complete",
};

const toNumber = (value: string): number => parseFloat(value) || 0;

/**
 * LibreSpeed testState: -1 not started, 0 starting, 1 download, 2 ping,
 * 3 upload, 4 finished, 5 aborted. The ping state never occurs here: latency is
 * measured by measureLatency.ts and the worker is told to skip it (config.ts).
 * Returns null for states that don't change the stage.
 */
export function stageFromTestState(testState: number): Stage | null {
    switch (testState) {
        case 1:
            return "DOWNLOAD";
        case 3:
            return "UPLOAD";
        case 4:
            return "COMPLETE";
        default:
            return null;
    }
}

/** Live figure for the gauge, or null when the current state doesn't measure anything. */
export function liveValue(data: SpeedtestData): number | null {
    switch (data.testState) {
        case 1:
            return toNumber(data.dlStatus);
        case 3:
            return toNumber(data.ulStatus);
        default:
            return null;
    }
}

/**
 * Folds one worker update into the results. Only download and upload come from
 * the worker; ping and jitter are kept as they are.
 */
export function mergeResults(prev: Results, data: SpeedtestData): Results {
    if (data.testState >= 4) {
        return { ...prev, download: toNumber(data.dlStatus), upload: toNumber(data.ulStatus) };
    }

    return {
        ...prev,
        download: data.dlStatus && data.testState >= 1 ? toNumber(data.dlStatus) : prev.download,
        upload: data.ulStatus && data.testState >= 3 ? toNumber(data.ulStatus) : prev.upload,
    };
}

/** Ring fill, 0 to 100. Only throughput stages fill the ring; latency is in ms and has no natural scale. */
export function gaugeProgress(stage: Stage, value: number): number {
    if (stage !== "DOWNLOAD" && stage !== "UPLOAD" && stage !== "COMPLETE") return 0;
    return Math.min(100, Math.max(0, (value / GAUGE_MAX_MBPS) * 100));
}

export const isRunning = (stage: Stage) => stage !== "IDLE" && stage !== "COMPLETE";

export const formatMetric = (value: number) => (value > 0 ? value.toFixed(1) : "0.0");
