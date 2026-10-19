import { useCallback, useEffect, useRef, useState } from "react";
import { LATENCY_OPTIONS, PING_URL, WORKER_SETTINGS } from "./config";
import { measureLatency } from "./measureLatency";
import {
    EMPTY_RESULTS,
    liveValue,
    mergeResults,
    stageFromTestState,
    type Results,
    type Stage,
} from "./model";
import { Speedtest } from "./speedtest";

function createEngine(): Speedtest {
    const engine = new Speedtest();
    for (const [name, value] of Object.entries(WORKER_SETTINGS)) engine.setParameter(name, value);
    return engine;
}

/**
 * Runs a test in two parts: latency (ping and jitter, measureLatency.ts), then
 * the LibreSpeed engine for download and upload. Exposes progress as React state.
 */
export function useSpeedtest() {
    const engineRef = useRef<Speedtest | null>(null);
    const latencyRef = useRef<AbortController | null>(null);
    const [stage, setStage] = useState<Stage>("IDLE");
    const [results, setResults] = useState<Results>(EMPTY_RESULTS);
    const [currentValue, setCurrentValue] = useState(0);
    const [clientIp, setClientIp] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);

    useEffect(() => {
        engineRef.current = createEngine();
        return () => {
            latencyRef.current?.abort();
            engineRef.current?.abort();
        };
    }, []);

    const start = useCallback(async () => {
        const engine = engineRef.current;
        if (!engine || engine.getState() === 3 || latencyRef.current) return;

        setStage("PING");
        setResults(EMPTY_RESULTS);
        setCurrentValue(0);
        setWarning(null);

        // Part 1: latency. A failure here shouldn't cost the user the speed test.
        const controller = new AbortController();
        latencyRef.current = controller;
        try {
            const latency = await measureLatency({
                url: PING_URL,
                ...LATENCY_OPTIONS,
                signal: controller.signal,
                onProgress: ({ stats }) => {
                    if (!stats) return;
                    setCurrentValue(stats.ping);
                    setResults((prev) => ({ ...prev, ping: stats.ping, jitter: stats.jitter }));
                },
            });
            setResults((prev) => ({ ...prev, ping: latency.ping, jitter: latency.jitter }));
            // Handy when a number looks odd: which timing method ran, how many samples, what was set aside.
            console.debug("[speedtest] latency", latency);
        } catch (error) {
            if (controller.signal.aborted) return; // abort() already reset the screen
            setWarning(
                `${error instanceof Error ? error.message : "Latency could not be measured."} Download and upload still ran.`,
            );
        } finally {
            if (latencyRef.current === controller) latencyRef.current = null;
        }
        if (controller.signal.aborted) return;

        // Part 2: throughput.
        setStage("DOWNLOAD");
        setCurrentValue(0);

        engine.onupdate = (data) => {
            setClientIp(data.clientIp || null);

            const next = stageFromTestState(data.testState);
            if (next) setStage(next);

            const value = liveValue(data);
            if (value !== null) setCurrentValue(value);

            setResults((prev) => mergeResults(prev, data));
        };
        engine.onend = (aborted) => setStage(aborted ? "IDLE" : "COMPLETE");

        engine.start();
    }, []);

    const abort = useCallback(() => {
        latencyRef.current?.abort();
        latencyRef.current = null;

        engineRef.current?.abort();
        // The engine's abort() stops polling but leaves its state at "running", so
        // start() would refuse to run again. Swap in a fresh engine instead.
        engineRef.current = createEngine();
        setStage("IDLE");
    }, []);

    return {
        stage,
        results,
        /** What the gauge shows; always 0 when idle. */
        displayValue: stage === "IDLE" ? 0 : currentValue,
        clientIp,
        /** Set when latency couldn't be measured, so a 0 isn't mistaken for a result. */
        warning,
        start,
        abort,
    };
}
