import { useCallback, useState } from "react";

/**
 * NOTE: this is a UI gate, not security. VITE_* variables are inlined into the
 * JavaScript bundle at build time, and the fallback below ships in the source,
 * so anyone who opens devtools can read the key. Templates under /public are
 * also downloadable directly by URL. Real protection has to live on the server
 * or the reverse proxy (basic auth, SSO, ...).
 */
const ACCESS_KEY: string = import.meta.env.VITE_GENERATOR_PASSWORD || "dhyto123";

export function useAccessGate() {
    const [unlocked, setUnlocked] = useState(false);

    /** Returns true (and unlocks) when the key matches. */
    const unlock = useCallback((key: string): boolean => {
        const ok = key === ACCESS_KEY;
        if (ok) setUnlocked(true);
        return ok;
    }, []);

    const lock = useCallback(() => setUnlocked(false), []);

    return { unlocked, unlock, lock };
}
