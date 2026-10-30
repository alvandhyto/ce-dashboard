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

/**
 * What the engine page shows at one moment: the text of the elements OpenSpeedTest's
 * script writes to (engineFrame.ts reads them). Everything is still a string here.
 */
export interface EngineSnapshot {
    /** The line under the big number: "Milliseconds", "Testing download speed..", "Mbps upload", "All done"... */
    status: string;
    /** The big number: ping, then the live speed. */
    live: string;
    ping: string;
    jitter: string;
    download: string;
    upload: string;
    /** The script gave up reaching the test server. */
    failed: boolean;
    /**
     * The results link the script writes a few seconds after "All done" (OpenSpeedTest's "share
     * your result" URL, never opened here). It holds the full-precision figures, where the elements
     * above are rounded for display: ping and jitter to whole milliseconds. Empty until then.
     */
    report: string;
}

/** A result element holds a number once its test has produced one, and a dash before that. */
const hasNumber = (text: string) => Number.isFinite(parseFloat(text));
const toNumber = (text: string) => (hasNumber(text) ? parseFloat(text) : 0);

/**
 * Which stage the engine is in, from the status line.
 *
 * "Initializing.." comes before both the download and the upload; the download figure
 * tells them apart, because it is written when the download ends. The status is empty
 * while the pings run and reads "Milliseconds" once they are done, so both mean "still
 * on latency" (the stage we are already in).
 */
export function stageFromSnapshot(current: Stage, snap: EngineSnapshot): Stage {
    const status = snap.status.toLowerCase();
    if (status === "all done") return "COMPLETE";
    if (status.includes("upload")) return "UPLOAD";
    if (status.includes("download")) return "DOWNLOAD";
    if (status.startsWith("initializing")) return hasNumber(snap.download) ? "UPLOAD" : "DOWNLOAD";
    return current === "IDLE" ? "PING" : current;
}

/** The exact figures from the results link: d and u in Mbps, p and j in ms. Null until the link is written. */
export function parseReport(report: string): Results | null {
    if (!report) return null;
    let params: URLSearchParams;
    try {
        params = new URL(report).searchParams;
    } catch {
        return null;
    }
    const read = (key: string) => toNumber(params.get(key) ?? "");
    return { ping: read("p"), jitter: read("j"), download: read("d"), upload: read("u") };
}

/** True while the engine is actually moving data, so the big number is a speed and not left over from the pings. */
const isMeasuring = (status: string) => /^(testing|mbps)/i.test(status);

export interface EngineView {
    results: Results;
    /** What the gauge shows. */
    value: number;
}

/** Everything the screen shows about a test. */
export interface SpeedtestView extends EngineView {
    stage: Stage;
}

export const IDLE_VIEW: SpeedtestView = { stage: "IDLE", results: EMPTY_RESULTS, value: 0 };
export const STARTING_VIEW: SpeedtestView = { ...IDLE_VIEW, stage: "PING" };

/**
 * Turns a snapshot into what the screen shows. A throughput tile follows the live speed
 * while its test runs and takes the engine's final figure once there is one.
 */
export function viewFromSnapshot(stage: Stage, snap: EngineSnapshot): EngineView {
    const exact = parseReport(snap.report);
    if (exact) return { results: exact, value: exact.upload };

    const live = isMeasuring(snap.status) ? toNumber(snap.live) : 0;

    const results: Results = {
        ping: toNumber(snap.ping),
        jitter: toNumber(snap.jitter),
        download: hasNumber(snap.download) ? toNumber(snap.download) : stage === "DOWNLOAD" ? live : 0,
        upload: hasNumber(snap.upload) ? toNumber(snap.upload) : stage === "UPLOAD" ? live : 0,
    };

    switch (stage) {
        case "PING":
            return { results, value: results.ping };
        case "DOWNLOAD":
        case "UPLOAD":
            return { results, value: live };
        case "COMPLETE":
            return { results, value: results.upload };
        default:
            return { results, value: 0 };
    }
}

/** The next view from a snapshot. Returns `prev` itself when nothing changed, so a poll with no news renders nothing. */
export function nextView(prev: SpeedtestView, snap: EngineSnapshot): SpeedtestView {
    const stage = stageFromSnapshot(prev.stage, snap);
    const { results, value } = viewFromSnapshot(stage, snap);
    const same =
        stage === prev.stage &&
        value === prev.value &&
        results.ping === prev.results.ping &&
        results.jitter === prev.results.jitter &&
        results.download === prev.results.download &&
        results.upload === prev.results.upload;
    return same ? prev : { stage, results, value };
}

/** Ring fill, 0 to 100. Only throughput stages fill the ring; latency is in ms and has no natural scale. */
export function gaugeProgress(stage: Stage, value: number): number {
    if (stage !== "DOWNLOAD" && stage !== "UPLOAD" && stage !== "COMPLETE") return 0;
    return Math.min(100, Math.max(0, (value / GAUGE_MAX_MBPS) * 100));
}

export const isRunning = (stage: Stage) => stage !== "IDLE" && stage !== "COMPLETE";

export const formatMetric = (value: number) => (value > 0 ? value.toFixed(1) : "0.0");
