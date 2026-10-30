import { useCallback, useEffect, useState } from "react";
import { routeFromHash, routeToHash } from "../core/registry";
import type { Route } from "../core/types";

/**
 * The current route, kept in the URL hash. The browser's Back and Forward buttons work,
 * a refresh stays on the same page, and a page can be linked to. Hash rather than path,
 * so any static host serves it without rewrite rules.
 */
export function useHashRoute() {
    const [route, setRoute] = useState(() => routeFromHash(window.location.hash));

    useEffect(() => {
        // popstate covers Back/Forward and hash edits in the address bar.
        const sync = () => setRoute(routeFromHash(window.location.hash));
        window.addEventListener("popstate", sync);
        return () => window.removeEventListener("popstate", sync);
    }, []);

    const navigate = useCallback((next: Route) => {
        const hash = routeToHash(next);
        if (hash !== window.location.hash) {
            const { pathname, search } = window.location;
            window.history.pushState(null, "", hash || pathname + search);
        }
        setRoute(next);
    }, []);

    return [route, navigate] as const;
}
