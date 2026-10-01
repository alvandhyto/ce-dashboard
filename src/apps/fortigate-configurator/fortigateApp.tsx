import React, { useState, useMemo, useEffect } from "react";
import {
    AlertCircle,
    ArrowRight,
    Check,
    CheckCircle2,
    ChevronDown,
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
import { subtractOneFromIP, getLanPrefix } from "../../utils";

export type Series = "30G" | "40F";
export type FirmwareVersion = "7.2" | "7.4";

export interface FormData {
    hostname: string;
    sid_primary: string;
    ip_primary: string;
    sid_secondary: string;
    ip_secondary: string;
    ip_lan: string;
    loopback205: string;
}

const INITIAL_DATA: FormData = {
    hostname: "",
    sid_primary: "",
    ip_primary: "",
    sid_secondary: "",
    ip_secondary: "",
    ip_lan: "192.168.1.99",
    loopback205: "",
};

const HINTS = {
    hostname: "(e.g., 2026504937_KFC_KGD-BOULEVARD)",
    sid_primary: "(e.g., 2020233809)",
    ip_primary: "(e.g., 123.231.211.162)",
    ip_secondary: "(e.g., 1.5.12.166)",
    ip_lan: "(e.g., 192.168.1.99)",
    loopback205: "(e.g., 100.104.9.71)",
};

const LABEL_MAP: Record<keyof FormData, string> = {
    hostname: "Hostname",
    sid_primary: "SID Internet",
    ip_primary: "Internet IP",
    ip_secondary: "Broadband IP",
    ip_lan: "LAN IP",
    loopback205: "Loopback205 IP",
    sid_secondary: "Secondary Link SID",
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
    const [series, setSeries] = useState<Series>("30G");
    const [firmwareVersion, setFirmwareVersion] =
        useState<FirmwareVersion>("7.2");
    const [seriesDropdownOpen, setSeriesDropdownOpen] = useState(false);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const [dualLink, setDualLink] = useState(false);
    const [sdWan, setSdWan] = useState(false);
    const [formData, setFormData] = useState<FormData>(INITIAL_DATA);
    const [generatedConfig, setGeneratedConfig] = useState<string | null>(null);
    const [status, setStatus] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);
    const [templates, setTemplates] = useState<{
        [key in Series]: string | null;
    }>({
        "30G": null,
        "40F": null,
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setSeriesDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Fetch templates from public folder
    useEffect(() => {
        const loadTemplates = async () => {
            setLoading(true);
            try {
                const [res40f, res30g] = await Promise.all([
                    fetch(
                        `/kfc/Template Branch 40F ${firmwareVersion}.conf`,
                    ).then((r) => r.text()),
                    fetch(
                        `/kfc/Template Branch 30G ${firmwareVersion}.conf`,
                    ).then((r) => r.text()),
                ]);
                setTemplates({
                    "30G": res30g,
                    "40F": res40f,
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
    }, [firmwareVersion]);

    const ipValues = useMemo(() => {
        const hasBroadband =
            dualLink && formData.ip_secondary && formData.ip_secondary !== "";
        const finalIpLan = formData.ip_lan || "192.168.1.99";
        return {
            "[HOSTNAME]": formData.hostname,
            "[sid_primary]": formData.sid_primary,
            "[ip_primary]": formData.ip_primary,
            "[IP_GATEWAY_INTERNET]": formData.ip_primary
                ? subtractOneFromIP(formData.ip_primary)
                : "",
            "[IP_secondary]": dualLink ? formData.ip_secondary : "0.0.0.0",
            "[IP_GATEWAY_secondary]": hasBroadband
                ? subtractOneFromIP(formData.ip_secondary)
                : "0.0.0.0",
            "[IP_LAN]": getLanPrefix(finalIpLan),
            "[IP_LOOPBACK205]": formData.loopback205,
        };
    }, [formData, dualLink, firmwareVersion]);

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

        if (!formData.sid_primary) {
            setStatus({
                type: "error",
                message: "Main Link SID is required.",
            });
            return;
        }

        if (!formData.ip_primary) {
            setStatus({
                type: "error",
                message: "Main Link IP is required.",
            });
            return;
        }

        if (!formData.loopback205) {
            setStatus({
                type: "error",
                message: "Loopback 205 IP is required.",
            });
            return;
        }

        if (dualLink) {
            if (!formData.sid_secondary) {
                setStatus({
                    type: "error",
                    message:
                        "Secondary Link SID is required when Dual Link is checked.",
                });
                return;
            }
            if (!formData.ip_secondary) {
                setStatus({
                    type: "error",
                    message:
                        "Secondary Link IP is required when Dual Link is checked.",
                });
                return;
            }
        }

        let conf = template;
        Object.entries(ipValues).forEach(([placeholder, value]) => {
            if (value !== undefined) {
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

        /*// Download switch config if it exists
        if (series === "30G w/ Switch" && generatedSwitchConfig) {
            // Add a short delay for Safari/browsers to handle multiple downloads
            setTimeout(() => {
                downloadFile(
                    generatedSwitchConfig,
                    `${formData.hostname_switch || "switch"}.conf`,
                );
            }, 600);
        }*/
    };

    const resetForm = () => {
        setFormData(INITIAL_DATA);
        setDualLink(false);
        setSdWan(false);
        setGeneratedConfig(null);
        setStatus(null);
    };

    const configLines = useMemo(() => {
        if (!generatedConfig) return [];
        return generatedConfig.split("\n");
    }, [generatedConfig]);

    const visibleFields = useMemo(() => {
        const fields = [
            {
                key: "hostname" as const,
                label: "Hostname",
                placeholder: HINTS.hostname,
                fullWidth: true,
            },
            {
                key: "sid_primary" as const,
                label: "Main Link SID",
                placeholder: HINTS.sid_primary,
                fullWidth: false,
            },
            {
                key: "ip_primary" as const,
                label: "Main Link IP",
                placeholder: HINTS.ip_primary,
                fullWidth: false,
            },
            ...(dualLink
                ? [
                      {
                          key: "sid_secondary" as const,
                          label: "Secondary Link SID",
                          placeholder: "(e.g., 2020233810)",
                          fullWidth: false,
                      },
                      {
                          key: "ip_secondary" as const,
                          label: "Secondary Link IP",
                          placeholder: HINTS.ip_secondary,
                          fullWidth: false,
                      },
                  ]
                : []),
            {
                key: "ip_lan" as const,
                label: "LAN IP",
                placeholder: HINTS.ip_lan,
                fullWidth: true,
            },
            {
                key: "loopback205" as const,
                label: "Loopback 205 IP",
                placeholder: HINTS.loopback205,
                fullWidth: true,
            },
        ];
        return fields;
    }, [series, dualLink]);

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
                            src="/icons/fortilogo.ico"
                            alt="Fortigate Logo"
                            className="w-10 h-10"
                        />
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-slate-100 flex items-center uppercase">
                            Fortigate Configuration Generator
                        </h1>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">
                            Internet Use Only
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
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch lg:h-[700px]">
                    {/* Form Section */}
                    <div className="lg:col-span-5 h-full self-start">
                        <section className="bg-white dark:bg-[#14181F] rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.02)] overflow-hidden flex flex-col border border-slate-100 dark:border-slate-800 h-full transition-colors">
                            <div className="p-8 pb-4">
                                <div className="flex items-center justify-between mb-8">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-rose-50 dark:bg-rose-900/20 rounded-lg flex items-center justify-center text-rose-600 dark:text-rose-400">
                                            <Settings className="w-4 h-4" />
                                        </div>
                                        <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.1em]">
                                            Configuration Parameters
                                        </h2>
                                    </div>
                                </div>

                                {/* Series Selector (Dropdown) */}
                                <div
                                    className="mb-6 relative"
                                    ref={dropdownRef}
                                >
                                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5 block px-1">
                                        Firewall Series
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setSeriesDropdownOpen(
                                                !seriesDropdownOpen,
                                            )
                                        }
                                        className="w-full h-12 px-5 bg-slate-50 dark:bg-[#1A1F26] border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center justify-between transition-all focus:ring-4 focus:ring-rose-50/50 dark:focus:ring-rose-950/20 focus:border-rose-600 dark:focus:border-rose-500 focus:outline-none cursor-pointer"
                                    >
                                        <span>
                                            {series === "30G" &&
                                                "FortiGate 30G"}
                                            {series === "40F" &&
                                                "FortiGate 40F"}
                                        </span>
                                        <ChevronDown
                                            className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-300 ${seriesDropdownOpen ? "rotate-180" : ""}`}
                                        />
                                    </button>

                                    <AnimatePresence>
                                        {seriesDropdownOpen && (
                                            <motion.div
                                                initial={{
                                                    opacity: 0,
                                                    y: -8,
                                                    scale: 0.95,
                                                }}
                                                animate={{
                                                    opacity: 1,
                                                    y: 0,
                                                    scale: 1,
                                                }}
                                                exit={{
                                                    opacity: 0,
                                                    y: -8,
                                                    scale: 0.95,
                                                }}
                                                transition={{
                                                    duration: 0.15,
                                                    ease: "easeOut",
                                                }}
                                                className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-[#1A1F26] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden py-1.5"
                                            >
                                                {(
                                                    ["30G", "40F"] as Series[]
                                                ).map((opt) => {
                                                    const isSelected =
                                                        opt === series;
                                                    return (
                                                        <button
                                                            key={opt}
                                                            type="button"
                                                            onClick={() => {
                                                                setSeries(opt);
                                                                setSeriesDropdownOpen(
                                                                    false,
                                                                );
                                                            }}
                                                            className={`w-full px-5 py-3 text-left text-sm font-bold transition-all flex items-center justify-between cursor-pointer ${
                                                                isSelected
                                                                    ? "text-rose-600 dark:text-rose-400 bg-rose-50/50 dark:bg-rose-950/20"
                                                                    : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                                                            }`}
                                                        >
                                                            <span>
                                                                {opt ===
                                                                    "30G" &&
                                                                    "FortiGate 30G"}
                                                                {opt ===
                                                                    "40F" &&
                                                                    "FortiGate 40F"}
                                                            </span>
                                                            {isSelected && (
                                                                <Check className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Features Block (Checkboxes) */}
                                <div className="grid grid-cols-2 gap-4 mb-2">
                                    {/* Dual Link Checkbox */}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const nextDualLink = !dualLink;
                                            setDualLink(nextDualLink);
                                            if (nextDualLink) {
                                                setSdWan(true);
                                            }
                                        }}
                                        className={`flex items-center gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer text-left ${
                                            dualLink
                                                ? "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400"
                                                : "bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/80 text-slate-400 hover:border-rose-500/30"
                                        }`}
                                    >
                                        <div
                                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                                                dualLink
                                                    ? "bg-rose-600 border-rose-600"
                                                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1A1F26]"
                                            }`}
                                        >
                                            {dualLink && (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <span
                                                className={`text-xs font-bold transition-colors ${dualLink ? "text-rose-900 dark:text-rose-300" : "text-slate-700 dark:text-slate-300"}`}
                                            >
                                                Dual Link
                                            </span>
                                        </div>
                                    </button>

                                    {/* SD-WAN Checkbox */}
                                    <button
                                        type="button"
                                        disabled={dualLink}
                                        onClick={() => setSdWan(!sdWan)}
                                        className={`flex items-center gap-3.5 p-4 rounded-2xl border transition-all text-left ${
                                            dualLink
                                                ? "opacity-55 cursor-not-allowed bg-slate-50/50 dark:bg-slate-900/20 border-slate-100 dark:border-slate-800 text-slate-300"
                                                : sdWan
                                                  ? "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 cursor-pointer"
                                                  : "bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/80 text-slate-400 cursor-pointer hover:border-rose-500/30"
                                        }`}
                                    >
                                        <div
                                            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all shrink-0 ${
                                                sdWan && !dualLink
                                                    ? "bg-rose-600 border-rose-600"
                                                    : "border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1A1F26]"
                                            }`}
                                        >
                                            {sdWan && (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                            )}
                                        </div>
                                        <div className="flex flex-col">
                                            <span
                                                className={`text-xs font-bold transition-colors ${sdWan && !dualLink ? "text-rose-900 dark:text-rose-300" : "text-slate-700 dark:text-slate-300"}`}
                                            >
                                                SD-WAN
                                            </span>
                                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">
                                                Optional for Single Link Use
                                            </span>
                                        </div>
                                    </button>
                                </div>
                            </div>

                            {/* Inputs Scroll Area */}
                            <div className="flex-1 overflow-auto px-8 pb-8 custom-scrollbar">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-6">
                                    {visibleFields.map((field) => (
                                        <div
                                            key={field.key}
                                            className={`relative ${field.fullWidth ? "md:col-span-2" : ""}`}
                                        >
                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2.5 block px-1">
                                                {field.label}
                                            </label>
                                            <div className="relative group">
                                                <input
                                                    type="text"
                                                    value={
                                                        formData[field.key] ||
                                                        ""
                                                    }
                                                    onChange={(e) =>
                                                        handleInputChange(
                                                            field.key,
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder={
                                                        field.placeholder
                                                    }
                                                    className="w-full h-11 px-5 bg-white dark:bg-[#1A1F26] border border-slate-200 dark:border-slate-800 rounded-2xl text-sm transition-all focus:ring-4 focus:ring-rose-50 dark:focus:ring-rose-900/10 focus:border-rose-600 dark:focus:border-rose-500 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 font-medium text-slate-900 dark:text-slate-100"
                                                />
                                                <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-focus-within:opacity-100 transition-opacity">
                                                    <div className="w-1.5 h-1.5 bg-rose-600 dark:bg-rose-400 rounded-full"></div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Generate Config Button */}
                            <div className="p-8 pt-6 border-t border-slate-50 dark:border-slate-800">
                                <button
                                    onClick={internalGenerateConfig}
                                    disabled={!formData.hostname}
                                    className="w-full h-14 bg-slate-900 dark:bg-rose-600 hover:bg-black dark:hover:bg-rose-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:cursor-not-allowed text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-200 dark:shadow-none transition-all flex items-center justify-center gap-3 active:scale-[0.98] cursor-pointer group"
                                >
                                    <Terminal className="w-4 h-4 text-rose-400 dark:text-rose-200 group-hover:rotate-12 transition-transform" />
                                    <span>GENERATE CONFIG</span>
                                    <ArrowRight className="w-4 h-4 opacity-30 group-hover:translate-x-1 transition-transform" />
                                </button>
                            </div>
                        </section>
                    </div>

                    {/* Result Section (Terminal) */}
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
                                        <FileCode className="w-4 h-4 text-rose-500 dark:text-rose-400" />
                                        <span className="text-slate-500 dark:text-slate-400 font-mono text-[10px] font-bold uppercase tracking-widest">
                                            {formData.hostname
                                                ? `${formData.hostname}.conf`
                                                : "fortigate.conf"}
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
