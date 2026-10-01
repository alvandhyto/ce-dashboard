import React, { useState, useMemo, useEffect } from "react";
import {
    Shield,
    Download,
    Terminal,
    CheckCircle2,
    AlertCircle,
    RefreshCcw,
    FileCode,
    ArrowRight,
    Settings,
    Sun,
    Moon,
    Loader2,
    Box,
    Network,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export interface LoopbackData {
    hostname: string;
    ip_loopback: string;
    main_interface: string;
    secondary_interface: string;
    dual_link: boolean;
    existing_bgp: boolean;
}

const INITIAL_DATA: LoopbackData = {
    hostname: "",
    ip_loopback: "",
    main_interface: "wan1",
    secondary_interface: "wan2",
    dual_link: false,
    existing_bgp: true,
};

const HINTS = {
    hostname: "(e.g., 2018010476-HAIER-BANDUNG)",
    ip_loopback: "(e.g., 100.104.6.38)",
    main_interface: "(e.g., wan1)",
    secondary_interface: "(e.g., wan2)",
};

const LABEL_MAP: Record<
    keyof Omit<LoopbackData, "dual_link" | "existing_bgp">,
    string
> = {
    hostname: "Hostname",
    ip_loopback: "IP Loopback",
    main_interface: "Main Interface",
    secondary_interface: "Secondary Interface",
};

const TerminalLine = React.memo(
    ({ line, index }: { line: string; index: number }) => {
        const trimmed = line.trim();
        const getLineClass = () => {
            if (trimmed.startsWith("edit") || trimmed.startsWith("config")) {
                return "text-amber-600 dark:text-amber-400 font-bold";
            }
            if (trimmed.startsWith("set")) {
                return "text-slate-900 dark:text-slate-100";
            }
            if (trimmed.startsWith("end") || trimmed.startsWith("next")) {
                return "text-amber-800 dark:text-amber-900";
            }
            if (trimmed.startsWith("#")) {
                return "text-slate-400 dark:text-slate-600 italic";
            }
            return "text-slate-400 dark:text-slate-500";
        };

        return (
            <div className="flex group hover:bg-slate-50 dark:hover:bg-white/5 -mx-10 px-10">
                <span className="w-12 text-slate-300 dark:text-slate-800 select-none text-right pr-8 shrink-0 font-bold">
                    {index + 1}
                </span>
                <span className={`whitespace-pre ${getLineClass()}`}>
                    {line}
                </span>
            </div>
        );
    },
);

export default function LoopbackConfigurator({
    onBack,
    isDarkMode,
    toggleTheme,
}: {
    onBack: () => void;
    isDarkMode: boolean;
    toggleTheme: () => void;
}) {
    const [formData, setFormData] = useState<LoopbackData>(INITIAL_DATA);
    const [generatedConfig, setGeneratedConfig] = useState<string | null>(null);
    const [status, setStatus] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const [loading, setLoading] = useState(false);

    const getTemplatePath = () => {
        const { dual_link, existing_bgp } = formData;
        if (dual_link && existing_bgp)
            return "/loopback/Template Dual-Link BGP Existing.txt";
        if (dual_link && !existing_bgp)
            return "/loopback/Template Dual-Link BGP New.txt";
        if (!dual_link && existing_bgp)
            return "/loopback/Template Single-Link BGP Existing.txt";
        return "/loopback/Template Single-Link BGP New.txt";
    };

    const handleInputChange = (
        field: keyof LoopbackData,
        value: string | boolean,
    ) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const generateConfig = async () => {
        setLoading(true);
        setStatus(null);
        try {
            const templatePath = getTemplatePath();
            const response = await fetch(templatePath);
            if (!response.ok)
                throw new Error(`Failed to load template: ${templatePath}`);
            let config = await response.text();

            const replacements = {
                "[IP_LOOPBACK]": formData.ip_loopback || "100.104.6.38",
                "[MAIN_INTERFACE]": formData.main_interface || "wan1",
                "[SECONDARY_INTERFACE]": formData.secondary_interface || "wan2",
            };

            Object.entries(replacements).forEach(([placeholder, value]) => {
                config = config.replaceAll(placeholder, value);
            });

            setGeneratedConfig(config);
            setStatus({
                type: "success",
                message: "Configuration generated!",
            });
        } catch (err: any) {
            console.error(err);
            setStatus({
                type: "error",
                message: err.message || "Failed to generate configuration.",
            });
        } finally {
            setLoading(false);
        }
    };

    const downloadConfig = () => {
        if (!generatedConfig) return;
        const hostname = formData.hostname || "unknown";
        const blob = new Blob([generatedConfig], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `LO205_${hostname}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const resetForm = () => {
        setFormData(INITIAL_DATA);
        setGeneratedConfig(null);
        setStatus(null);
    };

    const configLines = useMemo(() => {
        if (!generatedConfig) return [];
        return generatedConfig.split("\n");
    }, [generatedConfig]);

    return (
        <div className="min-h-screen p-8 md:p-12 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 select-none flex flex-col">
            {/* Sleek Header */}
            <header className="max-w-6xl mx-auto w-full flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
                    >
                        <ArrowRight className="w-4 h-4 rotate-180" />
                    </button>
                    <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <Network className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center uppercase">
                            Fortigate Loopback Config Generator
                        </h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">
                            Baru bisa buat link Internet
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={resetForm}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
                    >
                        <RefreshCcw className="w-4 h-4" />
                    </button>
                    <button
                        onClick={toggleTheme}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
                    >
                        {isDarkMode ? (
                            <Sun className="w-4 h-4" />
                        ) : (
                            <Moon className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-10 min-h-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch lg:h-[700px]">
                    {/* Form Section */}
                    <div className="lg:col-span-5 h-full self-start">
                        <section className="bg-white dark:bg-[#14181F] rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden flex flex-col border border-slate-100 dark:border-slate-800 h-full transition-colors">
                            <div className="p-8 pb-4">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-amber-50 dark:bg-amber-900/20 rounded-lg flex items-center justify-center text-amber-600 dark:text-amber-400">
                                            <Settings className="w-4 h-4" />
                                        </div>
                                        <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                                            Configuration Parameters
                                        </h2>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <button
                                        onClick={() =>
                                            handleInputChange(
                                                "dual_link",
                                                !formData.dual_link,
                                            )
                                        }
                                        className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                                            formData.dual_link
                                                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400"
                                                : "bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 text-slate-400"
                                        }`}
                                    >
                                        <div
                                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                                                formData.dual_link
                                                    ? "bg-amber-600 border-amber-600"
                                                    : "border-slate-300 dark:border-slate-700"
                                            }`}
                                        >
                                            {formData.dual_link && (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                            )}
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-widest">
                                            Dual Link
                                        </span>
                                    </button>

                                    <button
                                        onClick={() =>
                                            handleInputChange(
                                                "existing_bgp",
                                                !formData.existing_bgp,
                                            )
                                        }
                                        className={`flex items-center gap-3 p-4 rounded-2xl border transition-all cursor-pointer ${
                                            formData.existing_bgp
                                                ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400"
                                                : "bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800 text-slate-400"
                                        }`}
                                    >
                                        <div
                                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                                                formData.existing_bgp
                                                    ? "bg-amber-600 border-amber-600"
                                                    : "border-slate-300 dark:border-slate-700"
                                            }`}
                                        >
                                            {formData.existing_bgp && (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                            )}
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-widest">
                                            Existing BGP
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Inputs Scroll Area */}
                            <div className="flex-1 overflow-auto px-8 pb-4 custom-scrollbar">
                                <div className="space-y-6">
                                    {(
                                        [
                                            "hostname",
                                            "ip_loopback",
                                            "main_interface",
                                            "secondary_interface",
                                        ] as Array<
                                            keyof Omit<
                                                LoopbackData,
                                                "dual_link" | "existing_bgp"
                                            >
                                        >
                                    ).map((field) => (
                                        <div key={field}>
                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5 block px-1">
                                                {LABEL_MAP[field]}
                                            </label>
                                            <div className="relative group">
                                                <input
                                                    type="text"
                                                    value={formData[field]}
                                                    onChange={(e) =>
                                                        handleInputChange(
                                                            field,
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder={HINTS[field]}
                                                    className="w-full h-11 px-5 bg-white dark:bg-[#1A1F26] border border-slate-200 dark:border-slate-800 rounded-2xl text-sm transition-all focus:ring-4 focus:ring-amber-50 dark:focus:ring-amber-900/10 focus:border-amber-600 dark:focus:border-amber-500 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 font-medium text-slate-900 dark:text-slate-100"
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 transition-opacity">
                                                    <div className="w-1.5 h-1.5 bg-amber-600 dark:bg-amber-400 rounded-full"></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-8 pt-6 border-t border-slate-50 dark:border-slate-800">
                                <button
                                    onClick={generateConfig}
                                    disabled={loading || !formData.hostname}
                                    className="w-full h-14 bg-slate-900 dark:bg-amber-600 hover:bg-black dark:hover:bg-amber-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-200 dark:shadow-none transition-all flex items-center justify-center gap-3 active:scale-[0.98] cursor-pointer group"
                                >
                                    {loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                    ) : (
                                        <>
                                            <Terminal className="w-4 h-4 text-amber-400 dark:text-amber-200 group-hover:rotate-12 transition-transform" />
                                            <span>GENERATE CONFIG</span>
                                            <ArrowRight className="w-4 h-4 opacity-30 group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </section>
                    </div>

                    <div className="lg:col-span-7 h-full min-h-0">
                        <div className="bg-white dark:bg-[#0B0E14] rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden flex flex-col border border-slate-100 dark:border-slate-800/50 h-full min-h-[600px] transition-colors duration-300">
                            <div className="bg-slate-50/50 dark:bg-white/5 backdrop-blur-md px-8 py-5 flex items-center justify-between border-b border-slate-100 dark:border-white/5">
                                <div className="flex items-center gap-6">
                                    <div className="flex gap-2">
                                        <div className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500 hover:shadow-[0_0_10px_rgba(244,63,94,0.5)] transition-all duration-300"></div>
                                        <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500 hover:shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all duration-300"></div>
                                        <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500 hover:shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-300"></div>
                                    </div>
                                    <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-2"></div>
                                    <div className="flex items-center gap-2">
                                        <FileCode className="w-4 h-4 text-amber-500 dark:text-amber-400" />
                                        <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px] font-bold uppercase tracking-widest">
                                            {formData.hostname
                                                ? `LO205_${formData.hostname}.txt`
                                                : "fortigate.txt"}
                                        </span>
                                    </div>
                                </div>
                                {generatedConfig && (
                                    <button
                                        onClick={downloadConfig}
                                        className="flex items-center gap-2 py-2 px-6 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-black dark:hover:bg-slate-100 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl cursor-pointer active:scale-[0.98]"
                                    >
                                        <Download className="w-3.5 h-3.5" />
                                        Export Build
                                    </button>
                                )}
                            </div>

                            <div className="flex-1 relative min-h-0">
                                <AnimatePresence>
                                    {status && (
                                        <motion.div
                                            initial={{
                                                opacity: 0,
                                                scale: 0.9,
                                                y: 10,
                                            }}
                                            animate={{
                                                opacity: 1,
                                                scale: 1,
                                                y: 0,
                                            }}
                                            exit={{ opacity: 0, scale: 0.9 }}
                                            className={`absolute bottom-8 right-8 z-20 px-4 py-3 rounded-2xl text-xs font-black flex items-center gap-3 shadow-2xl backdrop-blur-xl border ${
                                                status.type === "success"
                                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                            }`}
                                        >
                                            {status.type === "success" ? (
                                                <CheckCircle2 className="w-4 h-4" />
                                            ) : (
                                                <AlertCircle className="w-4 h-4" />
                                            )}
                                            {status.message.toUpperCase()}
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="h-full overflow-auto p-4 font-mono text-[13px] leading-relaxed text-slate-500 dark:text-slate-400 custom-scrollbar">
                                    {configLines.length > 0 ? (
                                        <div className="space-y-1">
                                            {configLines.map((line, i) => (
                                                <TerminalLine
                                                    key={i}
                                                    line={line}
                                                    index={i}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center space-y-6 opacity-40">
                                            <div className="w-20 h-20 rounded-[2rem] bg-slate-50 dark:bg-white/5 flex items-center justify-center border border-slate-100 dark:border-white/5">
                                                <Terminal className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-slate-400 dark:text-slate-300 font-black tracking-widest text-xs uppercase">
                                                    Kernel Idle
                                                </p>
                                                <p className="text-slate-400 dark:text-slate-600 text-[10px] uppercase tracking-[0.2em] font-bold">
                                                    Awaiting parameter
                                                    submission
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Terminal Footer Info */}
                            <div className="bg-slate-50/50 dark:bg-black/20 border-t border-slate-100 dark:border-white/5 px-10 py-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-10">
                                        <div className="flex flex-col">
                                            <span className="text-[8px] text-slate-400 dark:text-slate-600 font-black uppercase tracking-widest mb-1">
                                                Status
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono font-bold tracking-tight">
                                                    STANDBY
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
