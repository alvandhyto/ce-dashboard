import {
    createContext,
    useCallback,
    useContext,
    useLayoutEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

const STORAGE_KEY = "theme";

interface ThemeContextValue {
    isDarkMode: boolean;
    toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readInitialTheme(): boolean {
    if (typeof window === "undefined") return false;
    try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) return saved === "dark";
    } catch {
        // storage can be blocked (private mode, policies); fall through to the OS setting
    }
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

/** Owns the light/dark choice, mirrors it onto <html class="dark"> and remembers it. */
export function ThemeProvider({ children }: { children: ReactNode }) {
    const [isDarkMode, setIsDarkMode] = useState(readInitialTheme);

    // Layout effect: apply the class before the first paint, so dark-mode users
    // don't see a flash of the light theme on load.
    useLayoutEffect(() => {
        document.documentElement.classList.toggle("dark", isDarkMode);
        try {
            window.localStorage.setItem(STORAGE_KEY, isDarkMode ? "dark" : "light");
        } catch {
            // ignore, the theme just won't persist
        }
    }, [isDarkMode]);

    const toggleTheme = useCallback(() => setIsDarkMode((prev) => !prev), []);
    const value = useMemo(() => ({ isDarkMode, toggleTheme }), [isDarkMode, toggleTheme]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
    const context = useContext(ThemeContext);
    if (!context) throw new Error("useTheme must be used inside <ThemeProvider>.");
    return context;
}
