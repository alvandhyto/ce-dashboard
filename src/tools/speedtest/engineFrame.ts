import { ENGINE_PATH, LOAD_TIMEOUT_MS } from "./config";
import type { EngineSnapshot } from "./model";
import { readSnapshot } from "./readSnapshot";

/** A running engine page. Closing it ends the test and everything the script started. */
export interface EngineHandle {
    /** Presses the page's own Start button, as a visitor of OpenSpeedTest's page would. */
    start(): void;
    /** The numbers on the page now, or null if the page can't be read any more. */
    read(): EngineSnapshot | null;
    /** Removes the frame. The script has no stop of its own, so this is how a test is cancelled. */
    destroy(): void;
}

/**
 * Loads the engine page in a frame nobody can see and resolves once it is ready to start.
 *
 * A fresh frame per test matters: OpenSpeedTest's script is a one-shot that can't be reset
 * or stopped, so every test gets a clean copy and Cancel simply throws it away.
 *
 * Rejects when the page isn't there. A missing file doesn't fail loudly: single-page-app
 * servers answer unknown paths with this app's own index.html, so the page is only accepted
 * if it holds the elements the script needs. A server that forbids framing
 * (X-Frame-Options) leaves a document we can't read, which counts as "not loaded" too.
 */
export function loadEngine(): Promise<EngineHandle> {
    return new Promise((resolve, reject) => {
        const frame = document.createElement("iframe");
        frame.src = ENGINE_PATH;
        frame.title = "Speedtest engine";
        frame.tabIndex = -1;
        frame.setAttribute("aria-hidden", "true");
        // 1 px and see-through, not display:none, so the browser treats it as a normal page and doesn't slow its timers.
        frame.style.cssText =
            "position:fixed;left:0;top:0;width:1px;height:1px;border:0;opacity:0;pointer-events:none;";

        let settled = false;
        const destroy = () => {
            window.clearTimeout(timeout);
            frame.remove();
        };
        const fail = (message: string) => {
            if (settled) return;
            settled = true;
            destroy();
            reject(new Error(message));
        };
        const timeout = window.setTimeout(
            () => fail("The speedtest engine took too long to load."),
            LOAD_TIMEOUT_MS,
        );

        frame.addEventListener("load", () => {
            if (settled) return;
            let doc: Document | null = null;
            try {
                doc = frame.contentDocument;
            } catch {
                doc = null;
            }
            const startButton = doc?.getElementById("startButtonDesk");
            if (!doc || !startButton) {
                fail(
                    `The speedtest engine didn't load. Check that its files are in public/openspeedtest/ and that the server allows ${ENGINE_PATH} in a frame from this site.`,
                );
                return;
            }

            settled = true;
            window.clearTimeout(timeout);
            resolve({
                start: () => startButton.click(),
                read: () => {
                    try {
                        return frame.isConnected ? readSnapshot(doc) : null;
                    } catch {
                        return null;
                    }
                },
                destroy,
            });
        });

        document.body.appendChild(frame);
    });
}
