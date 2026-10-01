import React, { useState, useEffect, useRef } from "react";
import {
    Activity,
    ArrowRight,
    Clock,
    Download,
    Moon,
    Sun,
    Upload,
} from "lucide-react";
import { motion } from "motion/react";
import { Speedtest, type SpeedtestData } from "./speedtest";

export default function SpeedTestApp({
    onBack,
    isDarkMode,
    toggleTheme,
}: {
    onBack: () => void;
    isDarkMode: boolean;
    toggleTheme: () => void;
}) {
    const [stage, setStage] = useState<
        "IDLE" | "PING" | "DOWNLOAD" | "UPLOAD" | "COMPLETE"
    >("IDLE");
    const [results, setResults] = useState({
        ping: 0,
        jitter: 0,
        download: 0,
        upload: 0,
    });
    const [currentValue, setCurrentValue] = useState(0);
    const [clientIp, setClientIp] = useState("N/A");

    const speedtestRef = useRef<Speedtest | null>(null);

    useEffect(() => {
        speedtestRef.current = new Speedtest();
        return () => {
            speedtestRef.current?.abort();
        };
    }, []);

    const startTest = () => {
        if (!speedtestRef.current) return;

        setStage("PING");
        setResults({ ping: 0, jitter: 0, download: 0, upload: 0 });
        setCurrentValue(0);

        speedtestRef.current.onupdate = (data) => {
            setClientIp(data.clientIp || "N/A");

            // Map testState to our stage
            // -1=not started, 0=starting, 1=download, 2=ping, 3=upload, 4=finished, 5=abort
            switch (data.testState) {
                case 1:
                    setStage("DOWNLOAD");
                    setCurrentValue(parseFloat(data.dlStatus) || 0);
                    break;
                case 2:
                    setStage("PING");
                    setCurrentValue(parseFloat(data.pingStatus) || 0);
                    break;
                case 3:
                    setStage("UPLOAD");
                    setCurrentValue(parseFloat(data.ulStatus) || 0);
                    break;
                case 4:
                    setStage("COMPLETE");
                    setResults({
                        ping: parseFloat(data.pingStatus) || 0,
                        jitter: parseFloat(data.jitterStatus) || 0,
                        download: parseFloat(data.dlStatus) || 0,
                        upload: parseFloat(data.ulStatus) || 0,
                    });
                    break;
            }

            // Update individual results as they come in
            if (data.pingStatus && data.testState >= 2) {
                setResults((prev) => ({
                    ...prev,
                    ping: parseFloat(data.pingStatus),
                }));
            }
            if (data.jitterStatus && data.testState >= 2) {
                setResults((prev) => ({
                    ...prev,
                    jitter: parseFloat(data.jitterStatus),
                }));
            }
            if (data.dlStatus && data.testState >= 1) {
                setResults((prev) => ({
                    ...prev,
                    download: parseFloat(data.dlStatus),
                }));
            }
            if (data.ulStatus && data.testState >= 3) {
                setResults((prev) => ({
                    ...prev,
                    upload: parseFloat(data.ulStatus),
                }));
            }
        };

        speedtestRef.current.onend = (aborted) => {
            if (!aborted) setStage("COMPLETE");
            else setStage("IDLE");
        };

        speedtestRef.current.start();
    };

    const abortTest = () => {
        speedtestRef.current?.abort();
        setStage("IDLE");
    };

    return (
        <div className="min-h-screen p-8 md:p-12 transition-colors flex flex-col font-sans">
            <header className="max-w-6xl mx-auto w-full flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
                    >
                        <ArrowRight className="w-5 h-5 rotate-180" />
                    </button>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center">
                        <img
                            src="/icons/lintaslogo.png"
                            alt="Lintas Logo"
                            className="w-9 h-9"
                        />
                    </div>
                    <div>
                        <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                            Speedtest
                        </h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            Delivery Lintasarta
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleTheme}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
                    >
                        {isDarkMode ? (
                            <Sun className="w-5 h-5" />
                        ) : (
                            <Moon className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </header>

            <div className="max-w-4xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-8 items-center py-10">
                <div className="lg:col-span-12 text-center mb-10">
                    <div className="relative inline-block">
                        <svg className="w-64 h-64 md:w-80 md:h-80 transform -rotate-90">
                            <circle
                                cx="50%"
                                cy="50%"
                                r="45%"
                                className="stroke-slate-100 dark:stroke-slate-800 fill-none"
                                strokeWidth="8"
                            />
                            <motion.circle
                                cx="50%"
                                cy="50%"
                                r="45%"
                                className="stroke-blue-500 fill-none"
                                strokeWidth="8"
                                strokeLinecap="round"
                                initial={{ strokeDasharray: "0 1000" }}
                                animate={{
                                    strokeDasharray:
                                        stage === "DOWNLOAD" ||
                                        stage === "UPLOAD"
                                            ? `${(currentValue / 600) * 1000} 1000`
                                            : stage === "COMPLETE"
                                              ? "800 1000"
                                              : "0 1000",
                                }}
                            />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-5xl md:text-7xl font-black text-slate-900 dark:text-white tracking-tighter">
                                {stage === "IDLE"
                                    ? "0"
                                    : Math.floor(currentValue)}
                            </span>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
                                {stage === "PING" ? "ms" : "mbps"}
                            </span>
                            {clientIp !== "N/A" && (
                                <span className="text-[10px] font-mono font-bold text-slate-300 dark:text-slate-700 mt-4 uppercase">
                                    IP: {clientIp}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="lg:col-span-12">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                        {[
                            {
                                label: "Latency",
                                value: results.ping,
                                unit: "ms",
                                icon: <Clock className="w-4 h-4" />,
                                active: stage === "PING",
                            },
                            {
                                label: "Jitter",
                                value: results.jitter,
                                unit: "ms",
                                icon: <Activity className="w-4 h-4" />,
                                active: stage === "PING",
                            },
                            {
                                label: "Download",
                                value: results.download,
                                unit: "mbps",
                                icon: <Download className="w-4 h-4" />,
                                active: stage === "DOWNLOAD",
                            },
                            {
                                label: "Upload",
                                value: results.upload,
                                unit: "mbps",
                                icon: <Upload className="w-4 h-4" />,
                                active: stage === "UPLOAD",
                            },
                        ].map((item, i) => (
                            <div
                                key={i}
                                className={`p-8 rounded-[2.5rem] border transition-all duration-500 ${
                                    item.active
                                        ? "bg-blue-500/10 border-blue-500/30 shadow-2xl shadow-blue-500/10 scale-105 z-10"
                                        : "bg-white dark:bg-[#14181F] border-slate-100 dark:border-slate-800"
                                }`}
                            >
                                <div
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center mb-6 ${
                                        item.active
                                            ? "bg-blue-500 text-white"
                                            : "bg-slate-50 dark:bg-slate-800 text-slate-400"
                                    }`}
                                >
                                    {item.icon}
                                </div>
                                <p className="text-[10px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest mb-1">
                                    {item.label}
                                </p>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                        {item.value || "0.0"}
                                    </span>
                                    <span className="text-[10px] font-bold text-slate-400">
                                        {item.unit}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="lg:col-span-12 mt-4">
                    <button
                        onClick={
                            stage === "IDLE" || stage === "COMPLETE"
                                ? startTest
                                : abortTest
                        }
                        className={`w-full py-5 rounded-3xl text-xs font-black uppercase tracking-[0.4em] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all ${
                            stage === "IDLE" || stage === "COMPLETE"
                                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                                : "bg-rose-500 text-white"
                        }`}
                    >
                        {stage === "IDLE"
                            ? "START SPEEDTEST"
                            : stage === "COMPLETE"
                              ? "RE-TEST"
                              : "CANCEL"}
                    </button>
                </div>
            </div>
        </div>
    );
}
