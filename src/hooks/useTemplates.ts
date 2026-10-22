import { useCallback, useEffect, useState } from "react";
import { cachedTemplates, loadTemplates } from "../lib/templates";

type State =
    | { status: "loading" }
    | { status: "ready"; texts: string[] }
    | { status: "error"; message: string };

/**
 * Loads one or more templates, with caching, cancellation and retry. The one
 * hook for every configurator, whether it needs a single file or several.
 *
 * - `templates` follows the order of `urls` and is null until all of them have
 *   loaded; one failure fails the lot.
 * - `template` is the first one, for the common single-file case.
 *
 * `urls` can be a new array on every render. Only its contents matter.
 */
export function useTemplates(urls: readonly string[]) {
    // A stable key, so a new array with the same contents doesn't refetch.
    const key = urls.join("\n");

    const [state, setState] = useState<State>(() => {
        const cached = cachedTemplates(urls);
        return cached ? { status: "ready", texts: cached } : { status: "loading" };
    });
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const cached = cachedTemplates(urls);
        if (cached) {
            setState({ status: "ready", texts: cached });
            return;
        }

        const controller = new AbortController();
        setState({ status: "loading" });

        loadTemplates(urls, controller.signal)
            .then((texts) => setState({ status: "ready", texts }))
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setState({
                    status: "error",
                    message: error instanceof Error ? error.message : "Unknown error.",
                });
            });

        return () => controller.abort();
        // `key` stands in for `urls`.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, attempt]);

    const retry = useCallback(() => setAttempt((n) => n + 1), []);

    const templates = state.status === "ready" ? state.texts : null;

    return {
        status: state.status,
        templates,
        template: templates?.[0] ?? null,
        error: state.status === "error" ? state.message : null,
        retry,
    };
}
