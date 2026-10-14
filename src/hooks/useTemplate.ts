import { useCallback, useEffect, useState } from "react";

type TemplateState =
    | { status: "loading" }
    | { status: "ready"; text: string }
    | { status: "error"; message: string };

/** Templates don't change during a session, so switching back and forth shouldn't refetch. */
const cache = new Map<string, string>();

async function fetchTemplate(url: string, signal: AbortSignal): Promise<string> {
    let response: Response;
    try {
        response = await fetch(url, { signal });
    } catch (error) {
        if (signal.aborted) throw error;
        throw new Error("Could not reach the server. Check your connection and try again.");
    }

    if (!response.ok) {
        throw new Error(`Template not found (HTTP ${response.status}). Check that the file exists in /public.`);
    }

    const text = await response.text();

    // Dev servers and SPA hosts answer unknown paths with index.html and a 200,
    // which would otherwise be "rendered" as if it were a config template.
    if (/^\s*<(!doctype|html)/i.test(text)) {
        throw new Error("Template not found. The server returned a web page instead of a .conf file.");
    }

    return text;
}

/** Loads one text template from `url`, with caching, cancellation and retry. */
export function useTemplate(url: string) {
    const [state, setState] = useState<TemplateState>(() => {
        const cached = cache.get(url);
        return cached === undefined ? { status: "loading" } : { status: "ready", text: cached };
    });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const cached = cache.get(url);
        if (cached !== undefined) {
            setState({ status: "ready", text: cached });
            return;
        }

        const controller = new AbortController();
        setState({ status: "loading" });

        fetchTemplate(url, controller.signal)
            .then((text) => {
                cache.set(url, text);
                setState({ status: "ready", text });
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setState({
                    status: "error",
                    message: error instanceof Error ? error.message : "Unknown error.",
                });
            });

        return () => controller.abort();
    }, [url, attempt]);

    const retry = useCallback(() => setAttempt((n) => n + 1), []);

    return {
        status: state.status,
        template: state.status === "ready" ? state.text : null,
        error: state.status === "error" ? state.message : null,
        retry,
    };
}
