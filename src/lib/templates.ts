/**
 * Loading of text templates (config files under /public). No React in here, so
 * it can be tested on its own; hooks/useTemplates.ts is the React side.
 */

/** Templates don't change during a session, so switching back and forth shouldn't refetch. */
const templateCache = new Map<string, string>();

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

/** Loads several templates in parallel, reusing anything already fetched this session. Same order as `urls`. */
export async function loadTemplates(urls: readonly string[], signal: AbortSignal): Promise<string[]> {
    return Promise.all(
        urls.map(async (url) => {
            const cached = templateCache.get(url);
            if (cached !== undefined) return cached;

            const text = await fetchTemplate(url, signal);
            templateCache.set(url, text);
            return text;
        }),
    );
}

/** All of `urls` from the cache, or null when any is missing. */
export function cachedTemplates(urls: readonly string[]): string[] | null {
    const texts = urls.map((url) => templateCache.get(url));
    return texts.every((text): text is string => text !== undefined) ? texts : null;
}
