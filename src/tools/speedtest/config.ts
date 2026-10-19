/**
 * Where the latency samples are sent. Use the same file the LibreSpeed worker
 * uses for `url_ul` and `url_ping` (backend/empty.php by default, which the
 * worker resolves against its own location). If you changed those in
 * public/speedtest_worker.js, change this to match.
 */
export const PING_URL = "/backend/empty.php";

/** How the latency test runs. See measureLatency.ts for what each one means. */
export const LATENCY_OPTIONS = {
    count: 30,
    warmup: 2,
    maxDurationMs: 6000,
    timeoutMs: 3000,
} as const;

/**
 * Settings handed to the LibreSpeed worker. "P" (ping and jitter) is left out of
 * the order on purpose: latency is measured by measureLatency.ts instead.
 */
export const WORKER_SETTINGS = {
    test_order: "I_D_U",
} as const;
