/**
 * The measuring engine: OpenSpeedTest's script, on a page of its own in public/openspeedtest/
 * (see the README for what goes in that folder). The app loads it in an invisible frame and
 * shows the numbers in its own interface. BASE_URL keeps the path right under a sub-path.
 */
export const ENGINE_PATH = `${import.meta.env.BASE_URL}openspeedtest/index.html`;

/** How often the app reads the engine's numbers. */
export const POLL_INTERVAL_MS = 100;

/** How long the engine page gets to load before the test is given up. */
export const LOAD_TIMEOUT_MS = 15_000;

/**
 * A normal test takes about 45 s (10 pings, then 12 s each for download and upload).
 * Past this, something is stuck, and the test is stopped rather than left spinning.
 */
export const MAX_TEST_MS = 120_000;

/**
 * After "All done" the script animates its own gauge to zero (3 s) and only then writes the
 * exact figures. This is how long the app waits for them before keeping the rounded ones.
 */
export const REPORT_WAIT_MS = 5_000;
