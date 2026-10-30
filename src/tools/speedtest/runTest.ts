import { MAX_TEST_MS, POLL_INTERVAL_MS, REPORT_WAIT_MS } from "./config";
import { loadEngine } from "./engineFrame";
import { nextView, STARTING_VIEW, type SpeedtestView } from "./model";

const SERVER_DOWN = "The test server didn't answer. Check the connection and the server setup.";

interface TestCallbacks {
    /** A new view; only called when something on screen changes. */
    onView(view: SpeedtestView): void;
    /** The test could not run or was stopped. The frame is already gone. */
    onFail(message: string): void;
    /** All four figures are in. The frame is already gone. */
    onFinish(): void;
}

/**
 * Runs one test on the OpenSpeedTest engine (engineFrame.ts): loads its page, presses Start
 * and reads its numbers ten times a second until the exact final figures are in.
 *
 * Returns a function that cancels the test. The engine has no stop of its own, so cancelling
 * closes its frame, and nothing is reported after that.
 */
export function runTest({ onView, onFail, onFinish }: TestCallbacks): () => void {
    let closed = false;
    let closeEngine = () => {};
    let timer: number | undefined;

    const close = () => {
        closed = true;
        window.clearInterval(timer);
        closeEngine();
    };
    const fail = (message: string) => {
        close();
        onFail(message);
    };

    loadEngine().then(
        (engine) => {
            if (closed) return engine.destroy();
            closeEngine = engine.destroy;

            const startedAt = Date.now();
            let completedAt = 0;
            let view = STARTING_VIEW;

            timer = window.setInterval(() => {
                const snapshot = engine.read();
                if (!snapshot) return fail("The speedtest engine stopped responding.");
                if (snapshot.failed) return fail(SERVER_DOWN);
                if (Date.now() - startedAt > MAX_TEST_MS) return fail("The speedtest took too long and was stopped.");

                const next = nextView(view, snapshot);
                if (next !== view) onView((view = next));

                if (view.stage !== "COMPLETE") return;
                completedAt ||= Date.now();
                if (snapshot.report || Date.now() - completedAt > REPORT_WAIT_MS) {
                    close();
                    onFinish();
                }
            }, POLL_INTERVAL_MS);

            engine.start();
        },
        (error: unknown) => {
            if (!closed) fail(error instanceof Error ? error.message : "The speedtest engine could not be loaded.");
        },
    );

    return close;
}
