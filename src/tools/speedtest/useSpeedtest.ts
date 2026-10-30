import { useCallback, useEffect, useRef, useState } from "react";
import { IDLE_VIEW, isRunning, STARTING_VIEW, type SpeedtestView } from "./model";
import { runTest } from "./runTest";

/**
 * A speedtest as React state. The test itself runs outside React (runTest.ts); this hook
 * starts and cancels it and keeps what it reports.
 */
export function useSpeedtest() {
    const [view, setView] = useState<SpeedtestView>(IDLE_VIEW);
    const [warning, setWarning] = useState<string | null>(null);
    /** When the last test's exact figures came in; null before that, and while a test runs. */
    const [finishedAt, setFinishedAt] = useState<Date | null>(null);
    /** Cancels the running test; null when none is running. */
    const cancelRef = useRef<(() => void) | null>(null);

    const stop = useCallback(() => {
        cancelRef.current?.();
        cancelRef.current = null;
    }, []);

    useEffect(() => stop, [stop]);

    const start = useCallback(() => {
        if (cancelRef.current) return;
        setView(STARTING_VIEW);
        setWarning(null);
        setFinishedAt(null);
        cancelRef.current = runTest({
            onView: setView,
            onFail: (message) => {
                cancelRef.current = null;
                setView(IDLE_VIEW);
                setWarning(message);
            },
            onFinish: () => {
                cancelRef.current = null;
                setFinishedAt(new Date());
            },
        });
    }, []);

    const abort = useCallback(() => {
        stop();
        setView(IDLE_VIEW);
    }, [stop]);

    return {
        ...view,
        running: isRunning(view.stage),
        /** Set when a test could not run or was stopped, so a 0 isn't mistaken for a result. */
        warning,
        finishedAt,
        start,
        abort,
    };
}
