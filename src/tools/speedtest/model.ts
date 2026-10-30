export type Stage = "IDLE" | "PING" | "DOWNLOAD" | "UPLOAD" | "COMPLETE";

export interface Results {
    ping: number;
    jitter: number;
    download: number;
    upload: number;
}

const EMPTY_RESULTS: Results = { ping: 0, jitter: 0, download: 0, upload: 0 };

export type Direction = "download" | "upload";

/** One live speed reading: when it was taken (Date.now()) and the speed in Mbps. */
export interface Sample {
    at: number;
    mbps: number;
}

/** The live readings of each throughput test, oldest first. They draw the graph and set the gauge's scale. */
export type Samples = Readonly<Record<Direction, readonly Sample[]>>;

const NO_SAMPLES: Samples = { download: [], upload: [] };

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

interface EngineView {
    results: Results;
    /** What the gauge shows. */
    value: number;
}

/** Everything the screen shows about a test. */
export interface SpeedtestView extends EngineView {
    stage: Stage;
    samples: Samples;
}

export const IDLE_VIEW: SpeedtestView = { stage: "IDLE", results: EMPTY_RESULTS, value: 0, samples: NO_SAMPLES };
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

/**
 * Which throughput test is moving data right now, if any. A test's final figure is written
 * when it ends, after which the engine only winds its own gauge down: that isn't a reading.
 */
function measuringDirection(stage: Stage, snap: EngineSnapshot): Direction | null {
    if (!isMeasuring(snap.status)) return null;
    if (stage === "DOWNLOAD" && !hasNumber(snap.download)) return "download";
    if (stage === "UPLOAD" && !hasNumber(snap.upload)) return "upload";
    return null;
}

/**
 * The next view from a snapshot taken at `now` (Date.now()). Returns `prev` itself when
 * nothing changed, so a poll with no news renders nothing.
 */
export function nextView(prev: SpeedtestView, snap: EngineSnapshot, now: number): SpeedtestView {
    const stage = stageFromSnapshot(prev.stage, snap);
    const { results, value } = viewFromSnapshot(stage, snap);

    let samples = prev.samples;
    const direction = measuringDirection(stage, snap);
    if (direction && value > 0) {
        samples = { ...samples, [direction]: [...samples[direction], { at: now, mbps: value }] };
    }

    const same =
        stage === prev.stage &&
        value === prev.value &&
        samples === prev.samples &&
        results.ping === prev.results.ping &&
        results.jitter === prev.results.jitter &&
        results.download === prev.results.download &&
        results.upload === prev.results.upload;
    return same ? prev : { stage, results, value, samples };
}

/** Round scale ends per decade. Close together, so the arc ends up between about 65% and 90% full. */
const SCALE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];

/**
 * The smallest round number above `mbps` with some headroom, so the arc never sits pinned at
 * its end. Fed the highest speed seen so far, it only ever grows during a test. 10 Mbps at least.
 */
export function scaleMax(mbps: number): number {
    const needed = Math.max(10, mbps * 1.1);
    const decade = 10 ** Math.floor(Math.log10(needed));
    const step = SCALE_STEPS.find((s) => s * decade >= needed) ?? 10;
    return step * decade;
}

export const peakOf = (samples: readonly Sample[]) =>
    samples.reduce((peak, sample) => Math.max(peak, sample.mbps), 0);

/** From 1 Gbps up, speeds read better in Gbps. Decided by the scale, so a whole scale shares one unit. */
export type SpeedUnit = "Gbps" | "Mbps";

export const speedUnit = (scale: number): SpeedUnit => (scale >= 1_000 ? "Gbps" : "Mbps");

/** A speed in the given unit: Mbps whole from 10 up, Gbps with two decimals (one from 10 Gbps). */
export function formatSpeed(mbps: number, unit: SpeedUnit): string {
    if (unit === "Mbps") return mbps >= 10 ? String(Math.floor(mbps)) : mbps.toFixed(1);
    const gbps = mbps / 1_000;
    return gbps.toFixed(gbps >= 10 ? 1 : 2);
}

/** A scale mark without trailing zeros: 12.5, 250, 2.5. */
export const formatScale = (mbps: number, unit: SpeedUnit) =>
    String(Number((unit === "Gbps" ? mbps / 1_000 : mbps).toFixed(2)));

export const isRunning = (stage: Stage) => stage !== "IDLE" && stage !== "COMPLETE";

export const formatMetric = (value: number) => (value > 0 ? value.toFixed(1) : "0.0");

/** A result tile's speed: Gbps with two decimals from 1000 Mbps up, so a fast link doesn't print six digits. */
export function formatThroughput(mbps: number): { value: string; unit: SpeedUnit } {
    return mbps >= 1_000
        ? { value: (mbps / 1_000).toFixed(2), unit: "Gbps" }
        : { value: formatMetric(mbps), unit: "Mbps" };
}
