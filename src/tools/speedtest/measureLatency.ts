/**
 * Measures round-trip time to the speed test server with a series of tiny HTTP
 * requests, then summarises them (see latencyStats.ts).
 *
 * Why this replaces the ping stage of the LibreSpeed worker:
 * - One measurement method per test. The worker mixes Performance API values
 *   with wall-clock estimates inside one run, which adds variation that has
 *   nothing to do with the network.
 * - The Resource Timing entry is looked up by the request's own URL, not taken
 *   as "the last entry in the buffer".
 * - Time is request start to first byte (Resource Timing), so connection setup,
 *   JavaScript scheduling and the page's own rendering don't count.
 * - Warm-up requests are discarded, and no sample is invented to cover a
 *   reading below the timer's resolution.
 */
import { summarizeLatency, type LatencyStats } from "./latencyStats";

export type LatencyMethod = "resource-timing" | "wall-clock";

export interface LatencyOptions {
    /** Endpoint that answers with an empty body, e.g. /backend/empty.php. */
    url: string;
    /** Measured round trips wanted. Default 30. */
    count?: number;
    /** Requests made first and thrown away, so the connection is open and warm. Default 2. */
    warmup?: number;
    /** Stop after this long even if `count` isn't reached. Default 6000. */
    maxDurationMs?: number;
    /** Give up on a single request after this long. Default 3000. */
    timeoutMs?: number;
    /** Give up on the whole test after this many failures in a row. Default 3. */
    maxConsecutiveFailures?: number;
    signal?: AbortSignal;
    onProgress?: (progress: LatencyProgress) => void;
}

export interface LatencyProgress {
    /** Figures so far. Null until the first sample. */
    stats: LatencyStats | null;
    done: number;
    total: number;
}

export interface LatencyResult extends LatencyStats {
    /** Requests that failed or came back with an error status. */
    lost: number;
    /** Requests that answered but couldn't be timed the way the rest were. */
    skipped: number;
    method: LatencyMethod;
}

/** What the measurement needs from the outside world. Swapped for fakes in tests. */
export interface LatencyEnv {
    now(): number;
    fetch(
        url: string,
        init: { signal: AbortSignal; cache: "no-store" },
    ): Promise<{ ok: boolean; status: number; arrayBuffer(): Promise<ArrayBuffer> }>;
    /** Request start to first byte for this URL from Resource Timing, or null when unavailable. */
    timingFor(url: string): Promise<number | null>;
}

export const browserEnv: LatencyEnv = {
    now: () => performance.now(),
    fetch: (url, init) => fetch(url, init),

    async timingFor(url) {
        const absolute = new URL(url, location.href).href;

        // The entry can land a moment after the response, so look twice.
        for (let attempt = 0; attempt < 2; attempt++) {
            const entry = performance.getEntriesByName(absolute, "resource").at(-1) as
                | PerformanceResourceTiming
                | undefined;

            if (entry) {
                // Zeros mean the browser withheld the details (cross-origin without Timing-Allow-Origin).
                const firstByte = entry.responseStart - entry.requestStart;
                return entry.requestStart > 0 && firstByte > 0 ? firstByte : null;
            }
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
        return null;
    },
};

const abortError = () => new DOMException("The latency measurement was aborted.", "AbortError");

interface Timed {
    /** Request start until the response headers arrived. */
    wall: number;
    ttfb: number | null;
}

/** One request. Null for anything but a clean answer: error, timeout, bad status or abort. */
async function timedRequest(
    env: LatencyEnv,
    url: string,
    timeoutMs: number,
    outer?: AbortSignal,
): Promise<Timed | null> {
    const controller = new AbortController();
    const forwardAbort = () => controller.abort();
    outer?.addEventListener("abort", forwardAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const started = env.now();
        const response = await env.fetch(url, { signal: controller.signal, cache: "no-store" });
        const wall = env.now() - started;

        await response.arrayBuffer(); // drain, so the timing entry is complete
        if (!response.ok) return null;

        return { wall, ttfb: await env.timingFor(url) };
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
        outer?.removeEventListener("abort", forwardAbort);
    }
}

/**
 * Rejects with an AbortError when `signal` fires, and with an Error when the
 * server never answered. Anything in between returns what could be measured.
 */
export async function measureLatency(
    options: LatencyOptions,
    env: LatencyEnv = browserEnv,
): Promise<LatencyResult> {
    const {
        url,
        count = 30,
        warmup = 2,
        maxDurationMs = 6000,
        timeoutMs = 3000,
        maxConsecutiveFailures = 3,
        signal,
        onProgress,
    } = options;

    const round: number[] = [];
    let lost = 0;
    let skipped = 0;
    let failuresInARow = 0;
    let method: LatencyMethod | null = null;

    const startedAt = env.now();
    const separator = url.includes("?") ? "&" : "?";

    for (let attempt = 0; attempt < warmup + count; attempt++) {
        if (signal?.aborted) throw abortError();
        if (attempt >= warmup && env.now() - startedAt > maxDurationMs) break;

        // A fresh query string each time keeps caches out of the way.
        const target = `${url}${separator}r=${attempt}-${Math.random().toString(36).slice(2)}`;
        const result = await timedRequest(env, target, timeoutMs, signal);
        if (signal?.aborted) throw abortError();

        if (!result) {
            if (attempt >= warmup) lost++;
            if (++failuresInARow >= maxConsecutiveFailures) break;
            continue;
        }
        failuresInARow = 0;

        // The first answer decides how every sample in this test is timed. Mixing is what we avoid.
        method ??= result.ttfb !== null ? "resource-timing" : "wall-clock";
        if (attempt < warmup) continue;

        const value = method === "resource-timing" ? result.ttfb : result.wall;
        if (value === null) {
            skipped++;
            continue;
        }

        round.push(value);
        onProgress?.({ stats: summarizeLatency(round), done: attempt - warmup + 1, total: count });
    }

    const stats = summarizeLatency(round);
    if (!stats || !method) {
        throw new Error(
            `No usable answer from ${url}. Check that the endpoint exists and replies with an empty body.`,
        );
    }

    return { ...stats, lost, skipped, method };
}
