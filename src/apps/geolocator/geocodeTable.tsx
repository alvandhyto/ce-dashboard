import React, { useState, useRef, useEffect } from "react";
import {
    Download,
    ChevronDown,
    Copy,
    Check,
    FileSpreadsheet,
    FileText,
    MapPin,
    AlertCircle,
    CheckCircle2,
    Search,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";

export interface GeocodeResultRow {
    inputAddr: string;
    status: string;
    subDistrict: string;
    district: string;
    city: string;
    state: string;
    country: string;
    zipCode: string;
    latLong: string;
    reg: string;
    area: string;
    cluster: string;
    arep: string;
    lat?: number;
    lon?: number;
}

interface GeocodeResultTableProps {
    rows: GeocodeResultRow[];
    onSelectRow?: (row: GeocodeResultRow) => void;
}

export const GeocodeResultTable: React.FC<GeocodeResultTableProps> = ({
    rows,
    onSelectRow,
}) => {
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [filterQuery, setFilterQuery] = useState("");
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
            document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const exportToXLSX = () => {
        const wb = XLSX.utils.book_new();
        const exportData = rows.map((r) => ({
            "Input Addr": r.inputAddr,
            Status: r.status,
            "Sub District": r.subDistrict,
            District: r.district,
            City: r.city,
            State: r.state,
            Country: r.country,
            ZipCode: r.zipCode,
            "Lat Long": r.latLong,
            Reg: r.reg,
            Area: r.area,
            Cluster: r.cluster,
            Arep: r.arep,
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, "Geolocator Result");
        XLSX.writeFile(wb, "Indonesia_Geolocator_Result.xlsx");
        setDropdownOpen(false);
    };

    const exportToCSV = () => {
        const headers = [
            "Input Addr",
            "Status",
            "Sub District",
            "District",
            "City",
            "State",
            "Country",
            "ZipCode",
            "Lat Long",
            "Reg",
            "Area",
            "Cluster",
            "Arep",
        ];

        const escapeCSV = (val: string) => {
            if (!val) return "";
            if (val.includes(",") || val.includes('"') || val.includes("\n")) {
                return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        };

        const csvRows = [
            headers.join(","),
            ...rows.map((r) =>
                [
                    escapeCSV(r.inputAddr),
                    escapeCSV(r.status),
                    escapeCSV(r.subDistrict),
                    escapeCSV(r.district),
                    escapeCSV(r.city),
                    escapeCSV(r.state),
                    escapeCSV(r.country),
                    escapeCSV(r.zipCode),
                    escapeCSV(r.latLong),
                    escapeCSV(r.reg),
                    escapeCSV(r.area),
                    escapeCSV(r.cluster),
                    escapeCSV(r.arep),
                ].join(","),
            ),
        ];

        const blob = new Blob([csvRows.join("\n")], {
            type: "text/csv;charset=utf-8;",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "Indonesia_Geolocator_Result.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setDropdownOpen(false);
    };

    const copyToClipboard = () => {
        const headers = [
            "Input Addr",
            "Status",
            "Sub District",
            "District",
            "City",
            "State",
            "Country",
            "ZipCode",
            "Lat Long",
            "Reg",
            "Area",
            "Cluster",
            "Arep",
        ];

        const tsvRows = [
            headers.join("\t"),
            ...rows.map((r) =>
                [
                    r.inputAddr,
                    r.status,
                    r.subDistrict,
                    r.district,
                    r.city,
                    r.state,
                    r.country,
                    r.zipCode,
                    r.latLong,
                    r.reg,
                    r.area,
                    r.cluster,
                    r.arep,
                ].join("\t"),
            ),
        ];

        navigator.clipboard.writeText(tsvRows.join("\n"));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        setDropdownOpen(false);
    };

    if (rows.length === 0) return null;

    const filteredRows = rows.filter((r) => {
        if (!filterQuery.trim()) return true;
        const q = filterQuery.toLowerCase();
        return (
            r.inputAddr.toLowerCase().includes(q) ||
            r.subDistrict.toLowerCase().includes(q) ||
            r.district.toLowerCase().includes(q) ||
            r.city.toLowerCase().includes(q) ||
            r.state.toLowerCase().includes(q) ||
            r.status.toLowerCase().includes(q) ||
            r.zipCode.toLowerCase().includes(q)
        );
    });

    const isSuccess = (status: string) => status.toUpperCase() === "OK";
    const isOutside = (status: string) =>
        status.toUpperCase().includes("OUTSIDE") ||
        status.toUpperCase().includes("NON-ID");

    return (
        <div className="w-full flex flex-col h-full overflow-hidden font-sans space-y-4">
            {/* Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">
                            Search Results
                        </h3>
                    </div>
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                        {rows.length} {rows.length === 1 ? "Record" : "Records"}
                    </span>
                </div>

                <div className="flex items-center gap-2.5">
                    {/* Live Table Filter for multi-row batches */}
                    {rows.length > 3 && (
                        <div className="relative group">
                            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                            <input
                                type="text"
                                value={filterQuery}
                                onChange={(e) => setFilterQuery(e.target.value)}
                                placeholder="Filter records..."
                                className="h-9 pl-8 pr-3 bg-slate-50 dark:bg-[#1A1F26] border border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 dark:focus:border-emerald-500 transition-all w-36 sm:w-48 font-medium"
                            />
                        </div>
                    )}

                    {/* Export Dropdown */}
                    <div
                        className="relative inline-block text-left"
                        ref={dropdownRef}
                    >
                        <button
                            type="button"
                            onClick={() => setDropdownOpen((prev) => !prev)}
                            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer active:scale-95"
                            id="export-dropdown-button"
                        >
                            <Download className="w-3.5 h-3.5" />
                            <span>Export</span>
                            <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                        </button>

                        <AnimatePresence>
                            {dropdownOpen && (
                                <motion.div
                                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 4, scale: 0.96 }}
                                    transition={{ duration: 0.15 }}
                                    className="absolute right-0 mt-2 w-56 rounded-2xl bg-white dark:bg-[#1A1F26] shadow-2xl border border-slate-200/80 dark:border-slate-800 p-1.5 z-50 text-xs"
                                >
                                    <button
                                        type="button"
                                        onClick={exportToXLSX}
                                        className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl flex items-center gap-3 text-slate-700 dark:text-slate-200 cursor-pointer font-bold transition-colors"
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                            <FileSpreadsheet className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="font-black text-slate-900 dark:text-white">
                                                Excel Sheet
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-medium">
                                                Download .xlsx file
                                            </div>
                                        </div>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={exportToCSV}
                                        className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl flex items-center gap-3 text-slate-700 dark:text-slate-200 cursor-pointer font-bold transition-colors"
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center text-blue-600 dark:text-blue-400">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="font-black text-slate-900 dark:text-white">
                                                CSV Document
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-medium">
                                                Standard comma separated
                                            </div>
                                        </div>
                                    </button>

                                    <div className="my-1 border-t border-slate-100 dark:border-slate-800" />

                                    <button
                                        type="button"
                                        onClick={copyToClipboard}
                                        className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/80 rounded-xl flex items-center gap-3 text-slate-700 dark:text-slate-200 cursor-pointer font-bold transition-colors"
                                    >
                                        <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300">
                                            {copied ? (
                                                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                                            ) : (
                                                <Copy className="w-4 h-4" />
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-black text-slate-900 dark:text-white">
                                                {copied
                                                    ? "Copied!"
                                                    : "Copy to Clipboard"}
                                            </div>
                                            <div className="text-[10px] text-slate-400 font-medium">
                                                {copied
                                                    ? "TSV text copied"
                                                    : "Tab-delimited table"}
                                            </div>
                                        </div>
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>

            {/* Table Card Container */}
            <div className="flex-1 w-full overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#14181F] shadow-sm flex flex-col">
                <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse text-xs whitespace-nowrap min-w-[1200px]">
                        <thead>
                            <tr className="bg-slate-50/90 dark:bg-[#1A1F26] border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-black uppercase tracking-wider sticky top-0 z-20 backdrop-blur-sm">
                                <th className="px-4 py-3 border-r border-slate-200/80 dark:border-slate-800">
                                    Address
                                </th>
                                <th className="px-4 py-3 border-r border-slate-200/80 dark:border-slate-800">
                                    Status
                                </th>
                                <th className="px-4 py-3 border-r border-slate-200/80 dark:border-slate-800">
                                    Sub District (Kec.)
                                </th>
                                <th className="px-4 py-3 border-r border-slate-200/80 dark:border-slate-800">
                                    District (Kel./Desa)
                                </th>
                                <th className="px-4 py-3 border-r border-slate-200/80 dark:border-slate-800">
                                    City / Kab.
                                </th>
                                <th className="px-4 py-3 border-r border-slate-200/80 dark:border-slate-800">
                                    State (Provinsi)
                                </th>
                                <th className="px-4 py-3 border-r border-slate-200/80 dark:border-slate-800">
                                    Country
                                </th>
                                <th className="px-4 py-3 border-r border-slate-200/80 dark:border-slate-800">
                                    Zip Code
                                </th>
                                <th className="px-4 py-3 border-r border-slate-200/80 dark:border-slate-800">
                                    Lat Long
                                </th>
                                <th className="px-4 py-3 border-r border-slate-200/80 dark:border-slate-800">
                                    Reg
                                </th>
                                <th className="px-4 py-3 border-r border-slate-200/80 dark:border-slate-800">
                                    Area
                                </th>
                                <th className="px-4 py-3 border-r border-slate-200/80 dark:border-slate-800">
                                    Cluster
                                </th>
                                <th className="px-4 py-3 border-r border-slate-200/80 dark:border-slate-800">
                                    Arep
                                </th>
                                <th className="px-4 py-3 text-center">Map</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80 text-slate-700 dark:text-slate-300 font-medium">
                            {filteredRows.map((row, idx) => {
                                const success = isSuccess(row.status);
                                const outside = isOutside(row.status);

                                return (
                                    <tr
                                        key={idx}
                                        onClick={() =>
                                            onSelectRow && onSelectRow(row)
                                        }
                                        className={`transition-colors group ${
                                            onSelectRow
                                                ? "hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 cursor-pointer"
                                                : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                        }`}
                                    >
                                        <td
                                            className="px-4 py-3 border-r border-slate-100 dark:border-slate-800/80 font-bold text-slate-900 dark:text-white max-w-[200px] truncate"
                                            title={row.inputAddr}
                                        >
                                            {row.inputAddr}
                                        </td>
                                        <td className="px-4 py-3 border-r border-slate-100 dark:border-slate-800/80">
                                            {success ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    OK
                                                </span>
                                            ) : outside ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50">
                                                    <AlertCircle className="w-3 h-3" />
                                                    {row.status}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50">
                                                    <AlertCircle className="w-3 h-3" />
                                                    {row.status}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 border-r border-slate-100 dark:border-slate-800/80">
                                            {row.subDistrict || "-"}
                                        </td>
                                        <td className="px-4 py-3 border-r border-slate-100 dark:border-slate-800/80">
                                            {row.district || "-"}
                                        </td>
                                        <td className="px-4 py-3 border-r border-slate-100 dark:border-slate-800/80 font-medium">
                                            {row.city || "-"}
                                        </td>
                                        <td className="px-4 py-3 border-r border-slate-100 dark:border-slate-800/80">
                                            {row.state || "-"}
                                        </td>
                                        <td className="px-4 py-3 border-r border-slate-100 dark:border-slate-800/80">
                                            <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                                {row.country || "Indonesia"}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 border-r border-slate-100 dark:border-slate-800/80 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                                            {row.zipCode || "-"}
                                        </td>
                                        <td className="px-4 py-3 border-r border-slate-100 dark:border-slate-800/80 font-mono text-[11px] text-slate-800 dark:text-slate-200 font-semibold">
                                            {row.latLong || "-"}
                                        </td>
                                        <td className="px-4 py-3 border-r border-slate-100 dark:border-slate-800/80 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                            {row.reg || "PMD"}
                                        </td>
                                        <td className="px-4 py-3 border-r border-slate-100 dark:border-slate-800/80 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                            {row.area || "DOMSA"}
                                        </td>
                                        <td className="px-4 py-3 border-r border-slate-100 dark:border-slate-800/80 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                            {row.cluster || "SAST"}
                                        </td>
                                        <td className="px-4 py-3 border-r border-slate-100 dark:border-slate-800/80 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                                            {row.arep || "SAST"}
                                        </td>
                                        <td className="px-3 py-2 text-center">
                                            {row.lat !== undefined &&
                                                row.lon !== undefined && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (onSelectRow)
                                                                onSelectRow(
                                                                    row,
                                                                );
                                                        }}
                                                        className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-500 dark:hover:text-slate-900 transition-all cursor-pointer inline-flex items-center justify-center shadow-xs"
                                                        title="View Location & Distance on Map"
                                                    >
                                                        <MapPin className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Table Footer with Summary */}
                <div className="p-3 bg-slate-50/90 dark:bg-[#1A1F26] border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 shrink-0 px-4">
                    <div className="flex items-center gap-2">
                        <span>
                            Showing {filteredRows.length} of {rows.length}{" "}
                            entries
                        </span>
                        {filterQuery && (
                            <button
                                onClick={() => setFilterQuery("")}
                                className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                            >
                                Clear filter
                            </button>
                        )}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
                        Click any row to view interactive proximity radar &
                        distance
                    </div>
                </div>
            </div>
        </div>
    );
};
