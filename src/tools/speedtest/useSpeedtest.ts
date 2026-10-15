import { useCallback, useEffect, useRef, useState } from "react";
import {
    EMPTY_RESULTS,
    liveValue,
    mergeResults,
    stageFromTestState,
    type Results,
    type Stage,
} from "./model";
import { Speedtest } from "./speedtest";

/** Runs the LibreSpeed engine and exposes its progress as React state. */
export function useSpeedtest() {
    const engineRef = useRef<Speedtest | null>(null);
    const [stage, setStage] = useState<Stage>("IDLE");
    const [results, setResults] = useState<Results>(EMPTY_RESULTS);
    const [currentValue, setCurrentValue] = useState(0);
    const [clientIp, setClientIp] = useState<string | null>(null);

    useEffect(() => {
        engineRef.current = new Speedtest();
        return () => engineRef.current?.abort();
    }, []);

    const start = useCallback(() => {
        const engine = engineRef.current;
        if (!engine || engine.getState() === 3) return;

        setStage("PING");
        setResults(EMPTY_RESULTS);
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
        engineRef.current?.abort();
        // The engine's abort() stops polling but leaves its state at "running", so
        // start() would refuse to run again. Swap in a fresh engine instead.
        engineRef.current = new Speedtest();
        setStage("IDLE");
    }, []);

    return {
        stage,
        results,
        /** What the gauge shows; always 0 when idle. */
        displayValue: stage === "IDLE" ? 0 : currentValue,
        clientIp,
        start,
        abort,
    };
}
