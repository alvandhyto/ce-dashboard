import React, { useState, useMemo, useEffect } from "react";
import {
    AlertCircle,
    ArrowRight,
    CheckCircle2,
    Download,
    FileCode,
    Loader2,
    Moon,
    RefreshCcw,
    Settings,
    Sun,
    Terminal,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { subtractOneFromIP, getFirstThreeOctets } from "../../utils";

export type Series = "40F" | "30G";

export interface FormData {
    hostname: string;
    site_name: string;
    sid_internet: string;
    ip_internet: string;
    ip_lan: string;
    loopback205: string;
}

const INITIAL_DATA: FormData = {
    hostname: "",
    site_name: "",
    sid_internet: "",
    ip_internet: "",
    ip_lan: "",
    loopback205: "",
};

const HINTS = {
    hostname: "e.g., 2026707526-LION-BDOAP",
    site_name: "e.g., BDOAP",
    sid_internet: "e.g., 2026707525",
    ip_internet: "e.g., 202.152.37.78",
    ip_lan: "e.g., 192.168.51.1",
    loopback205: "e.g., 100.104.16.173",
};

const LABEL_MAP: Record<keyof FormData, string> = {
    hostname: "Hostname",
    site_name: "Site Name",
    sid_internet: "SID Internet",
    ip_internet: "Internet IP",
    ip_lan: "LAN IP",
    loopback205: "Loopback205 IP",
};

// Sub-component for individual terminal lines to optimize performance
const TerminalLine = React.memo(
    ({ line, index }: { line: string; index: number }) => {
        const trimmed = line.trim();
        const getLineClass = () => {
            if (trimmed.startsWith("edit") || trimmed.startsWith("config")) {
                return "text-rose-600 dark:text-rose-400 font-bold";
            }
            if (trimmed.startsWith("set")) {
                return "text-slate-900 dark:text-slate-100";
            }
            if (trimmed.startsWith("end") || trimmed.startsWith("next")) {
                return "text-rose-800 dark:text-rose-900";
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

export default function NetworkConfigurator({
    onBack,
    isDarkMode,
    toggleTheme,
}: {
    onBack: () => void;
    isDarkMode: boolean;
    toggleTheme: () => void;
}) {
    const [series, setSeries] = useState<Series>("40F");
    const [formData, setFormData] = useState<FormData>(INITIAL_DATA);
    const [generatedConfig, setGeneratedConfig] = useState<string | null>(null);
    const [status, setStatus] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const [templates, setTemplates] = useState<{
        [key in Series]: string | null;
    }>({
        "40F": null,
        "30G": null,
    });
    const [loading, setLoading] = useState(true);

    // Fetch templates from public folder
    useEffect(() => {
        const loadTemplates = async () => {
            setLoading(true);
            try {
                const [res40f, res30g] = await Promise.all([
                    fetch(
                        "/templates/lion-mentari/Template Branch 40F 7.2.13.conf",
                    ).then((r) => r.text()),
                    fetch(
                        "/templates/lion-mentari/Template Branch 30G 7.2.11.conf",
                    ).then((r) => r.text()),
                ]);
                setTemplates({
                    "40F": res40f,
                    "30G": res30g,
                });
            } catch (err) {
                console.error("Failed to load templates:", err);
                setStatus({
                    type: "error",
                    message:
                        "Failed to load configuration templates from /public",
                });
            } finally {
                setLoading(false);
            }
        };
        loadTemplates();
    }, []);

    const ipValues = useMemo(() => {
        return {
            "[HOSTNAME]": formData.hostname,
            "[SITE_NAME]": formData.site_name,
            "[SID_INTERNET]": formData.sid_internet,
            "[IP_INTERNET]": formData.ip_internet,
            "[IP_GATEWAY_INTERNET]": subtractOneFromIP(formData.ip_internet),
            "[IP_LAN]": getFirstThreeOctets(formData.ip_lan),
            "[IP_LOOPBACK205]": formData.loopback205,
        };
    }, [formData]);

    const handleInputChange = (field: keyof FormData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const internalGenerateConfig = () => {
        const template = templates[series];

        if (!template) {
            setStatus({
                type: "error",
                message: `Template for ${series} is not loaded.`,
            });
            return;
        }

        if (!formData.hostname) {
            setStatus({
                type: "error",
                message: "Hostname is required to generate config.",
            });
            return;
        }

        let conf = template;
        Object.entries(ipValues).forEach(([placeholder, value]) => {
            if (value) {
                conf = conf.replaceAll(placeholder, value);
            }
        });

        setGeneratedConfig(conf);

        setStatus({
            type: "success",
            message: "Configuration generated!",
        });
    };

    const downloadConfig = () => {
        if (!generatedConfig) return;

        const downloadFile = (content: string, filename: string) => {
            const blob = new Blob([content], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        };

        // Download main Fortigate config
        downloadFile(generatedConfig, `${formData.hostname || "config"}.conf`);
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

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 transition-colors text-center">
                <Loader2 className="w-12 h-12 text-rose-600 animate-spin mb-6" />
                <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-xs">
                    LALALALLAALLALALA...
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-8 md:p-12 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 select-none flex flex-col">
            {/* Sleek Header */}
            <header className="max-w-6xl mx-auto w-full flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
                    >
                        <ArrowRight className="w-5 h-5 rotate-180" />
                    </button>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                        <img
                            src="/icons/lionlogo.png"
                            alt="Lion Logo"
                            className="w-10 h-10"
                        />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                            Lion Mentari Fortigate Configurator
                        </h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">
                            Regular Installs
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={resetForm}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
                    >
                        <RefreshCcw className="w-5 h-5" />
                    </button>
                    <button
                        onClick={toggleTheme}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
                    >
                        {isDarkMode ? (
                            <Sun className="w-5 h-5" />
                        ) : (
                            <Moon className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </header>

            <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-10 min-h-0">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch lg:h-[600px]">
                    {/* Form Section */}
                    <div className="lg:col-span-5 h-full self-start">
                        <section className="bg-white dark:bg-[#14181F] p-1 md:p-1 rounded-4xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors flex flex-col">
                            <div className="p-8 pb-4">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-rose-50 dark:bg-rose-900/20 rounded-xl flex items-center justify-center text-rose-600 dark:text-rose-400">
                                            <Settings className="w-4 h-4" />
                                        </div>
                                        <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                                            Configuration Parameters
                                        </h2>
                                    </div>
                                </div>

                                {/* Series Selector */}
                                <div className="mb-4 p-1.5 bg-slate-50 dark:bg-[#1A1F26] rounded-2xl border border-slate-100 dark:border-slate-800">
                                    <div className="grid grid-cols-2 gap-1 relative">
                                        {(["40F", "30G"] as Series[]).map(
                                            (m) => (
                                                <button
                                                    key={m}
                                                    onClick={() => setSeries(m)}
                                                    className={`relative z-10 py-2.5 rounded-sm text-[10px] font-black transition-colors cursor-pointer uppercase ${
                                                        series === m
                                                            ? "text-rose-600 dark:text-rose-400"
                                                            : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                                                    }`}
                                                >
                                                    {m}
                                                    {series === m && (
                                                        <motion.div
                                                            layoutId="active-series-bg"
                                                            className="absolute inset-0 bg-white dark:bg-[#14181F] shadow-sm border border-slate-100 dark:border-slate-800 rounded-xl -z-10"
                                                            transition={{
                                                                type: "spring",
                                                                bounce: 0.2,
                                                                duration: 0.6,
                                                            }}
                                                        />
                                                    )}
                                                </button>
                                            ),
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Inputs Scroll Area */}
                            <div className="flex-1 overflow-auto px-8 pb-8 custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                                    {(
                                        Object.keys(formData) as Array<
                                            keyof FormData
                                        >
                                    ).map((field) => {
                                        return (
                                            <div
                                                key={field}
                                                className={`relative ${field === "hostname" || field === "loopback205" ? "md:col-span-2" : ""}`}
                                            >
                                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5 block px-1">
                                                    {field === "hostname"
                                                        ? "Hostname"
                                                        : LABEL_MAP[field]}
                                                </label>
                                                <div className="relative group">
                                                    <input
                                                        type="text"
                                                        onChange={(e) =>
                                                            handleInputChange(
                                                                field,
                                                                e.target.value,
                                                            )
                                                        }
                                                        placeholder={
                                                            HINTS[field]
                                                        }
                                                        className="w-full h-11 px-4 bg-slate-50 dark:bg-[#1A1F26] border border-slate-200 dark:border-slate-800 rounded-xl text-sm transition-all focus:border-rose-600 dark:focus:border-rose-500 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 font-medium text-slate-900 dark:text-slate-100"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="p-8 pt-6 border-t border-slate-50 dark:border-slate-800">
                                <button
                                    onClick={internalGenerateConfig}
                                    disabled={!formData.hostname}
                                    className="w-full h-12 bg-slate-900 dark:bg-rose-600 hover:bg-black dark:hover:bg-rose-700 disabled:bg-slate-200 dark:disabled:bg-slate-800/80 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded-2xl font-black text-xs shadow-lg shadow-slate-900/10 dark:shadow-rose-900/20 transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] cursor-pointer uppercase tracking-wider"
                                >
                                    <Terminal className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                                    <span>GENERATE CONFIG</span>
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </section>
                    </div>

                    {/* Result Section (Terminal) */}
                    <div className="lg:col-span-7 h-full min-h-0">
                        <div className="bg-white dark:bg-[#14181F] border border-slate-100 dark:border-slate-800 rounded-4xl shadow-sm flex flex-col h-full min-h-[600px] transition-all duration-300 overflow-hidden">
                            <div className="bg-slate-50/50 dark:bg-white/5 backdrop-blur-md px-8 py-5 flex items-center justify-between border-b border-slate-100 dark:border-white/5">
                                <div className="flex items-center gap-4">
                                    <div className="flex gap-2">
                                        <div className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500/30 hover:bg-rose-500 hover:shadow-[0_0_10px_rgba(244,63,94,0.5)] transition-all duration-300"></div>
                                        <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/30 hover:bg-amber-500 hover:shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all duration-300"></div>
                                        <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/30 hover:bg-emerald-500 hover:shadow-[0_0_10px_rgba(16,185,129,0.5)] transition-all duration-300"></div>
                                    </div>
                                    <div className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-2"></div>
                                    <div className="flex items-center gap-2">
                                        <FileCode className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                                        <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px] font-bold uppercase tracking-widest">
                                            {formData.hostname
                                                ? `${formData.hostname}.conf`
                                                : "fortigate_lion.conf"}
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
                                        <div className="h-full w-full flex flex-col items-center justify-center text-center p-8 my-auto">
                                            <div className="w-16 h-16 bg-slate-100 dark:bg-[#1A1F26] rounded-2xl flex items-center justify-center mb-4 text-slate-400 dark:text-slate-600 border border-slate-200/60 dark:border-slate-800">
                                                <Terminal className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                                            </div>
                                            <div className="space-y-2">
                                                <p className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-1">
                                                    Kernel Idle
                                                </p>
                                                <p className="text-[11px] font-medium text-slate-400 max-w-[280px] leading-relaxed">
                                                    Awaiting parameter input
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

            {/* <footer className="mt-auto px-8 py-10 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#14181F] transition-colors">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-3">
                        <p className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-widest">
                            Developed by AVU
                        </p>
                    </div>
                </div>
            </footer> */}
        </div>
    );
}
