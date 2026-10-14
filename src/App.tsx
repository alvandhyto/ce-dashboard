import React, { useState, useEffect, useRef } from "react";
import {
    ArrowLeft,
    ArrowRight,
    ArrowUpDown,
    Folder,
    Layers,
    Loader2,
    Lock,
    Map,
    Moon,
    Network,
    Plus,
    ShieldAlert,
    Sun,
    Terminal,
} from "lucide-react";
import {
    motion,
    AnimatePresence,
    useMotionValue,
    useSpring,
    useTransform,
} from "motion/react";

// Import modular apps
import FortigateConfigurator from "./configurators/fortigate/FortigateConfigurator";
import Speedtest from "./apps/speedtest/speedtestApp";
import Placeholder from "./apps/placeholder/placeholderApp";

type AppType = "FORTIGATE" | "SPEEDTEST" | "PLACEHOLDER" | "GENERATORS" | null;

interface AppMetadata {
    id: AppType;
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
}

const APPS: AppMetadata[] = [
    {
        id: "SPEEDTEST",
        title: "Speedtest",
        description:
            "This speedtest application delivers accurate, real-time measurement of internet performance, including latency, jitter, download speed, upload speed.",
        icon: <ArrowUpDown className="w-6 h-6" />,
        color: "blue",
    },
    {
        id: "GENERATORS",
        title: "Generators",
        description:
            "Reliable tools designed to generate standardized configurations, ensuring consistency and operational efficiency.",
        icon: <Terminal className="w-7 h-7" />,
        color: "rose",
    },
    {
        id: "PLACEHOLDER",
        title: "Placeholder",
        description:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        icon: <Folder className="w-6 h-6" />,
        color: "amber",
    },
];

const GENERATOR_APPS: AppMetadata[] = [
    {
        id: "FORTIGATE",
        title: "Fortigate",
        description: "Fortigate firewall standardized configuration.",
        icon: (
            <img
                src="/icons/fortilogo.ico"
                alt="Fortigate Logo"
                className="w-10 h-10"
            />
        ),
        color: "rose",
    },
];

interface AppCardProps {
    app: AppMetadata;
    index: number;
    onClick: () => void;
    key?: React.Key;
}

function AppCard({ app, index, onClick }: AppCardProps) {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    const cardRef = useRef<HTMLDivElement>(null);

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!cardRef.current) return;
        const { left, top } = cardRef.current.getBoundingClientRect();
        mouseX.set(e.clientX - left);
        mouseY.set(e.clientY - top);
    };

    const springConfig = { damping: 30, stiffness: 200 };
    const smoothX = useSpring(mouseX, springConfig);
    const smoothY = useSpring(mouseY, springConfig);

    return (
        <motion.div
            ref={cardRef}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            onClick={onClick}
            onMouseMove={handleMouseMove}
            className="group relative cursor-pointer"
        >
            <div className="bg-white dark:bg-[#14181F] p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-[0_10px_40px_rgba(0,0,0,0.02)] hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 flex flex-col items-start overflow-hidden relative">
                {/* Dynamic Glow Spotlight */}
                <motion.div
                    className={`absolute pointer-events-none -inset-px rounded-[3rem] opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-0`}
                    style={{
                        background: useTransform(
                            [smoothX, smoothY],
                            ([x, y]) =>
                                `radial-gradient(400px circle at ${x}px ${y}px, ${
                                    app.color === "blue"
                                        ? "rgba(79, 70, 229, 0.15)"
                                        : app.color === "emerald"
                                          ? "rgba(16, 185, 129, 0.15)"
                                          : app.color === "rose"
                                            ? "rgba(245, 11, 11, 0.15)"
                                            : app.color === "amber"
                                              ? "rgba(245, 158, 11, 0.15)"
                                              : "rgba(79, 70, 229, 0.15)"
                                }, transparent 80%)`,
                        ),
                    }}
                />

                <div className="relative z-10 w-full flex flex-col items-start h-full">
                    <div
                        className={`w-14 h-14 ${
                            app.color === "blue"
                                ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                                : app.color === "emerald"
                                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
                                  : app.color === "rose"
                                    ? "bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400"
                                    : app.color === "amber"
                                      ? "bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"
                                      : "bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400"
                        } rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}
                    >
                        {app.icon}
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">
                        {app.title}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-8 flex-1">
                        {app.description}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-900 dark:text-white ">
                        Open{" "}
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export default function App() {
    const [activeApp, setActiveApp] = useState<AppType>(null);
    const [isGeneratorsAuthenticated, setIsGeneratorsAuthenticated] =
        useState(false);
    const [passwordInput, setPasswordInput] = useState("");
    const [passwordError, setPasswordError] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isDarkMode, setIsDarkMode] = useState(() => {
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem("theme");
            if (saved) return saved === "dark";
            return window.matchMedia("(prefers-color-scheme: dark)").matches;
        }
        return false;
    });

    useEffect(() => {
        // Initial platform sequence
        const timer = setTimeout(() => setLoading(false), 2000);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.add("dark");
            localStorage.setItem("theme", "dark");
        } else {
            document.documentElement.classList.remove("dark");
            localStorage.setItem("theme", "light");
        }
    }, [isDarkMode]);

    useEffect(() => {
        if (
            activeApp !== "GENERATORS" &&
            activeApp !== "KFC" &&
            activeApp !== "LOOPBACK" &&
            activeApp !== "LION" &&
            activeApp !== "CHATIME" &&
            activeApp !== "FORTIGATE"
        ) {
            setIsGeneratorsAuthenticated(false);
        }
    }, [activeApp]);

    const toggleTheme = () => {
        setIsDarkMode((prev) => !prev);
    };

    const handlePasswordSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setIsVerifying(true);
        setPasswordError(false);

        // Simulate a small delay for "security check" feel
        setTimeout(() => {
            const secret =
                import.meta.env.VITE_GENERATOR_PASSWORD || "dhyto123";
            if (passwordInput === secret) {
                setIsGeneratorsAuthenticated(true);
                setPasswordInput("");
            } else {
                setPasswordError(true);
            }
            setIsVerifying(false);
        }, 800);
    };

    const pageVariants = {
        initial: { opacity: 0, scale: 0.98 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 1.02 },
    };

    const pageTransition = {
        duration: 0.3,
        ease: "easeInOut",
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 transition-colors">
                <motion.div
                    animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-16 h-16 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-200 dark:shadow-blue-900/40 mb-8"
                >
                    <Layers className="w-8 h-8 text-white" />
                </motion.div>
                <p className="text-slate-400 dark:text-slate-600 font-black uppercase tracking-[0.4em] text-[10px]">
                    Initializing Dashboard
                </p>
            </div>
        );
    }

    return (
        <AnimatePresence mode="wait">
            {activeApp === "FORTIGATE" && (
                <motion.div
                    key="FORTIGATE"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                    className="min-h-screen"
                >
                    <FortigateConfigurator
                        onBack={() => setActiveApp("GENERATORS")}
                        isDarkMode={isDarkMode}
                        toggleTheme={toggleTheme}
                    />
                </motion.div>
            )}

            {activeApp === "SPEEDTEST" && (
                <motion.div
                    key="SPEEDTEST"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                    className="min-h-screen"
                >
                    <Speedtest
                        onBack={() => setActiveApp(null)}
                        isDarkMode={isDarkMode}
                        toggleTheme={toggleTheme}
                    />
                </motion.div>
            )}

            {activeApp === "PLACEHOLDER" && (
                <motion.div
                    key="PLACEHOLDER"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                    className="min-h-screen"
                >
                    <Placeholder
                        onBack={() => setActiveApp(null)}
                        isDarkMode={isDarkMode}
                        toggleTheme={toggleTheme}
                    />
                </motion.div>
            )}

            {activeApp === "GENERATORS" && !isGeneratorsAuthenticated && (
                <motion.div
                    key="PASSWORD_GATE"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                    className="min-h-screen flex items-center justify-center p-8 bg-slate-50 dark:bg-[#0B0E14]"
                >
                    <div className="max-w-md w-full bg-white dark:bg-[#14181F] rounded-[2.5rem] p-10 border border-slate-100 dark:border-slate-800 shadow-2xl shadow-blue-500/5 text-center">
                        <div className="w-20 h-20 bg-rose-50 dark:bg-rose-900/10 rounded-3xl flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto mb-8">
                            {passwordError ? (
                                <ShieldAlert className="w-10 h-10 animate-shake" />
                            ) : (
                                <Lock className="w-10 h-10" />
                            )}
                        </div>

                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-2">
                            Restricted Access
                        </h2>
                        <p className="text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-10 leading-relaxed">
                            Generating sensitive configurations requires
                            authentication.
                        </p>

                        <form
                            onSubmit={handlePasswordSubmit}
                            className="space-y-4"
                        >
                            <div className="relative group">
                                <input
                                    type="password"
                                    value={passwordInput}
                                    onChange={(e) =>
                                        setPasswordInput(e.target.value)
                                    }
                                    placeholder="ENTER ACCESS KEY"
                                    className={`w-full h-14 bg-slate-50 dark:bg-[#1A1F26] border ${
                                        passwordError
                                            ? "border-rose-500/50"
                                            : "border-slate-100 dark:border-slate-800"
                                    } rounded-2xl px-6 text-center font-mono text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-rose-500/20 transition-all text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-slate-700 uppercase`}
                                    autoFocus
                                />
                                {isVerifying && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <Loader2 className="w-5 h-5 text-rose-500 animate-spin" />
                                    </div>
                                )}
                            </div>

                            {passwordError && (
                                <motion.p
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-[10px] font-black text-rose-500 uppercase tracking-widest"
                                >
                                    Invalid credentials detected
                                </motion.p>
                            )}

                            <div className="pt-4 flex flex-col gap-3">
                                <button
                                    type="submit"
                                    disabled={!passwordInput || isVerifying}
                                    className="w-full h-14 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all active:scale-[0.98] shadow-xl shadow-slate-200 dark:shadow-none cursor-pointer flex items-center justify-center gap-2"
                                >
                                    {isVerifying
                                        ? "Verifying..."
                                        : "Authorize Access"}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveApp(null)}
                                    className="w-full h-14 bg-transparent text-slate-400 dark:text-slate-600 hover:text-slate-900 dark:hover:text-slate-300 font-black text-xs uppercase tracking-widest transition-colors cursor-pointer"
                                >
                                    Cancel Request
                                </button>
                            </div>
                        </form>
                    </div>
                </motion.div>
            )}

            {/* Generators App Selection Page */}
            {activeApp === "GENERATORS" && isGeneratorsAuthenticated && (
                <motion.div
                    key="GENERATORS_MENU"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                    className="min-h-screen p-8 md:p-16 font-sans selection:bg-rose-100 dark:selection:bg-rose-900/30"
                >
                    <div className="max-w-6xl mx-auto flex flex-col min-h-[80vh]">
                        <header className="pb-10 flex items-center justify-between">
                            <div className="flex items-center gap-6">
                                <button
                                    onClick={() => setActiveApp(null)}
                                    className="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-blue-400 transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
                                >
                                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                                </button>
                                <div>
                                    <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-1">
                                        Generators
                                    </h1>
                                    <p className="text-xl md:text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-tight">
                                        Standardized Configuration Generators
                                        for Various Projects
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={toggleTheme}
                                className="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-blue-400 transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
                            >
                                {isDarkMode ? (
                                    <Sun className="w-5 h-5" />
                                ) : (
                                    <Moon className="w-5 h-5" />
                                )}
                            </button>
                        </header>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                            {GENERATOR_APPS.map((app, i) => (
                                <AppCard
                                    key={app.id}
                                    app={app}
                                    index={i}
                                    onClick={() => setActiveApp(app.id)}
                                />
                            ))}

                            <div className="h-full bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-slate-800 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center opacity-60">
                                <div className="w-12 h-12 rounded-full border-2 border-slate-200 dark:border-slate-800 flex items-center justify-center mb-4">
                                    <Plus className="w-5 h-5 text-slate-300 dark:text-slate-700" />
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest font-black">
                                    Placeholder for Future Generators
                                </p>
                            </div>
                        </div>

                        <footer className="flex flex-col md:flex-row items-center justify-between gap-6 pt-10">
                            <p className="text-[10px] font-mono font-bold text-slate-300 dark:text-slate-700 uppercase">
                                Developed by AVU
                            </p>
                        </footer>
                    </div>
                </motion.div>
            )}

            {/* Dashboard (Landing Page) */}
            {activeApp === null && (
                <motion.div
                    key="DASHBOARD"
                    variants={pageVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={pageTransition}
                    className="min-h-screen p-8 md:p-16 transition-colors font-sans selection:bg-blue-100 dark:selection:bg-blue-900/30"
                >
                    <div className="max-w-6xl mx-auto flex flex-col min-h-[80vh]">
                        <header className="pb-10 flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tighter uppercase mb-1">
                                    Dashboard Delivery
                                </h1>
                                <p className="text-xl md:text-xs font-bold text-slate-400 dark:text-slate-600 uppercase tracking-tight">
                                    Hasil isengnya Dhyto
                                </p>
                            </div>
                            <button
                                onClick={toggleTheme}
                                className="p-3 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
                            >
                                {isDarkMode ? (
                                    <Sun className="w-5 h-5" />
                                ) : (
                                    <Moon className="w-5 h-5" />
                                )}
                            </button>
                        </header>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                            {APPS.map((app, i) => (
                                <AppCard
                                    key={app.id}
                                    app={app}
                                    index={i}
                                    onClick={() => setActiveApp(app.id)}
                                />
                            ))}

                            <div className="h-full bg-slate-50 dark:bg-white/5 border border-dashed border-slate-200 dark:border-slate-800 rounded-[3rem] p-10 flex flex-col items-center justify-center text-center opacity-60">
                                <div className="w-12 h-12 rounded-full border-2 border-slate-200 dark:border-slate-800 flex items-center justify-center mb-4">
                                    <div className="w-1.5 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full"></div>
                                </div>
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest font-black">
                                    Future Deployment Slot
                                </p>
                            </div>
                        </div>

                        <footer className="flex flex-col md:flex-row items-center justify-between pt-10">
                            <p className="text-[10px] font-mono font-bold text-slate-300 dark:text-slate-700 uppercase">
                                Developed by AVU
                            </p>
                        </footer>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
