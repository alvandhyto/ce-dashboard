import React, { useState, useEffect, useCallback } from "react";
import {
    ArrowRight,
    MapPin,
    Search,
    Loader2,
    Navigation,
    Moon,
    Sun,
    AlertCircle,
    Download,
    Map as MapIcon,
    X,
    Maximize2,
    Minimize2,
    TableProperties,
    Layers,
    Compass,
    Radio,
    Info,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import * as XLSX from "xlsx";
import L from "leaflet";
import { SITES_FALLBACK } from "./sitesFallback";
import { GeocodeResultTable, GeocodeResultRow } from "./geocodeTable";

interface Site {
    name: string;
    latitude: number;
    longitude: number;
    address?: string;
    [key: string]: any;
}

const HAVERSINE_RADIUS = 6371; // Earth radius in km

function calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
) {
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
            Math.cos(lat2 * (Math.PI / 180)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return HAVERSINE_RADIUS * c;
}

/**
 * Validates if coordinates fall within the sovereign territory of the Republic of Indonesia.
 * Approximate Indonesia Geographic Bounding Box:
 * Latitude: -11.2° (Rote/Timor) to +6.2° (Sabang/Weh Island)
 * Longitude: 94.8° (Sabang/Aceh) to 141.2° (Merauke/Papua)
 */
export function isWithinIndonesia(lat: number, lon: number): boolean {
    return lat >= -11.2 && lat <= 6.2 && lon >= 94.8 && lon <= 141.2;
}

function getIndonesianTelecomTaxonomy(state: string, city: string) {
    const s = `${state} ${city}`.toLowerCase();
    if (
        s.includes("jakarta") ||
        s.includes("dki") ||
        s.includes("tangerang") ||
        s.includes("bekasi") ||
        s.includes("depok") ||
        s.includes("bogor")
    ) {
        return {
            reg: "REG-2",
            area: "JABODETABEK",
            cluster: "JKT-CENTRAL",
            arep: "JKT-REP",
        };
    }
    if (
        s.includes("jawa barat") ||
        s.includes("bandung") ||
        s.includes("cirebon") ||
        s.includes("tasikmalaya") ||
        s.includes("garut")
    ) {
        return {
            reg: "REG-3",
            area: "WEST JAVA",
            cluster: "BDG-NORTH",
            arep: "BDG-REP",
        };
    }
    if (
        s.includes("jawa tengah") ||
        s.includes("yogyakarta") ||
        s.includes("semarang") ||
        s.includes("solo") ||
        s.includes("surakarta")
    ) {
        return {
            reg: "REG-4",
            area: "CENTRAL JAVA",
            cluster: "SMG-EAST",
            arep: "SMG-REP",
        };
    }
    if (
        s.includes("jawa timur") ||
        s.includes("surabaya") ||
        s.includes("malang") ||
        s.includes("jombang") ||
        s.includes("sidoarjo") ||
        s.includes("kediri")
    ) {
        return {
            reg: "REG-5",
            area: "EAST JAVA",
            cluster: "SBY-CENTRAL",
            arep: "SBY-REP",
        };
    }
    if (
        s.includes("sumatera") ||
        s.includes("sumatra") ||
        s.includes("aceh") ||
        s.includes("medan") ||
        s.includes("padang") ||
        s.includes("riau") ||
        s.includes("palembang") ||
        s.includes("lampung")
    ) {
        return {
            reg: "REG-1",
            area: "SUMATERA",
            cluster: "SUM-CLUSTER",
            arep: "SUM-REP",
        };
    }
    if (
        s.includes("bali") ||
        s.includes("nusa tenggara") ||
        s.includes("denpasar") ||
        s.includes("mataram") ||
        s.includes("kupang")
    ) {
        return {
            reg: "REG-4",
            area: "BALINUSRA",
            cluster: "BALI-SOUTH",
            arep: "DPS-REP",
        };
    }
    if (
        s.includes("kalimantan") ||
        s.includes("balikpapan") ||
        s.includes("samarinda") ||
        s.includes("banjarmasin") ||
        s.includes("pontianak")
    ) {
        return {
            reg: "REG-6",
            area: "KALIMANTAN",
            cluster: "KAL-EAST",
            arep: "BPN-REP",
        };
    }
    if (
        s.includes("sulawesi") ||
        s.includes("makassar") ||
        s.includes("manado") ||
        s.includes("papua") ||
        s.includes("maluku") ||
        s.includes("ambon") ||
        s.includes("jayapura")
    ) {
        return {
            reg: "REG-7",
            area: "EAST INDONESIA",
            cluster: "EID-CLUSTER",
            arep: "MKS-REP",
        };
    }
    return { reg: "PMD", area: "DOMSA", cluster: "SAST", arep: "SAST" };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parseNominatimAddress(
    inputAddr: string,
    item: any | null,
    overrideLat?: number,
    overrideLon?: number,
): GeocodeResultRow {
    if (!item) {
        return {
            inputAddr,
            status: "NOT FOUND",
            subDistrict: "-",
            district: "-",
            city: "-",
            state: "-",
            country: "Indonesia",
            zipCode: "-",
            latLong: "-",
            reg: "PMD",
            area: "DOMSA",
            cluster: "SAST",
            arep: "SAST",
        };
    }

    const addr = item.address || {};

    // Check if outside Indonesia
    const countryCode = addr.country_code?.toLowerCase();
    const lat = overrideLat !== undefined ? overrideLat : parseFloat(item.lat);
    const lon = overrideLon !== undefined ? overrideLon : parseFloat(item.lon);

    const isNonID =
        (countryCode && countryCode !== "id") ||
        (!isNaN(lat) && !isNaN(lon) && !isWithinIndonesia(lat, lon));

    if (isNonID) {
        return {
            inputAddr,
            status: "OUTSIDE INDONESIA",
            subDistrict: "-",
            district: "-",
            city: "-",
            state: "-",
            country: addr.country || "Non-Indonesia",
            zipCode: "-",
            latLong:
                !isNaN(lat) && !isNaN(lon)
                    ? `${Number(lat.toFixed(7))},${Number(lon.toFixed(7))}`
                    : "-",
            reg: "-",
            area: "-",
            cluster: "-",
            arep: "-",
            lat: isNaN(lat) ? undefined : lat,
            lon: isNaN(lon) ? undefined : lon,
        };
    }

    // Sub District (Kecamatan in Indonesia)
    const subDistrict =
        addr.city_district ||
        addr.subdistrict ||
        addr.county ||
        addr.municipality ||
        addr.district ||
        "-";

    // District (Kelurahan / Desa / Suburb / Village)
    const district =
        addr.suburb ||
        addr.village ||
        addr.quarter ||
        addr.neighbourhood ||
        addr.residential ||
        addr.hamlet ||
        addr.town ||
        "-";

    // City (Kota / Kabupaten)
    let city =
        addr.city ||
        addr.regency ||
        addr.state_district ||
        addr.municipality ||
        "";
    if (
        !city &&
        addr.county &&
        !addr.county.toLowerCase().includes("kecamatan")
    ) {
        city = addr.county;
    }
    if (!city) city = "-";

    // State (Provinsi)
    const state = addr.state || addr.province || addr.region || "-";

    // Country
    const country = "Indonesia";

    // ZipCode
    const zipCode = addr.postcode || addr.postal_code || "-";

    // LatLong
    const latLong =
        !isNaN(lat) && !isNaN(lon)
            ? `${Number(lat.toFixed(7))},${Number(lon.toFixed(7))}`
            : "-";

    const taxonomy = getIndonesianTelecomTaxonomy(state, city);

    return {
        inputAddr,
        status: "OK",
        subDistrict,
        district,
        city,
        state,
        country,
        zipCode,
        latLong,
        reg: taxonomy.reg,
        area: taxonomy.area,
        cluster: taxonomy.cluster,
        arep: taxonomy.arep,
        lat: isNaN(lat) ? undefined : lat,
        lon: isNaN(lon) ? undefined : lon,
    };
}

function formatGeocodeResult(
    inputAddr: string,
    item: any,
    lat?: number,
    lon?: number,
): GeocodeResultRow {
    if (!item) {
        return {
            inputAddr,
            status: "NOT FOUND",
            subDistrict: "-",
            district: "-",
            city: "-",
            state: "-",
            country: "Indonesia",
            zipCode: "-",
            latLong:
                lat !== undefined && lon !== undefined ? `${lat},${lon}` : "-",
            reg: "-",
            area: "-",
            cluster: "-",
            arep: "-",
            lat,
            lon,
        };
    }

    const resolvedLat =
        item.lat !== undefined
            ? Number(item.lat)
            : lat !== undefined
              ? lat
              : NaN;
    const resolvedLon =
        item.lon !== undefined
            ? Number(item.lon)
            : lon !== undefined
              ? lon
              : NaN;

    if (
        !isNaN(resolvedLat) &&
        !isNaN(resolvedLon) &&
        !isWithinIndonesia(resolvedLat, resolvedLon)
    ) {
        return {
            inputAddr,
            status: "OUTSIDE INDONESIA",
            subDistrict: "-",
            district: "-",
            city: "-",
            state: "-",
            country: item.country || "Outside ID",
            zipCode: "-",
            latLong: `${Number(resolvedLat.toFixed(7))},${Number(resolvedLon.toFixed(7))}`,
            reg: "-",
            area: "-",
            cluster: "-",
            arep: "-",
            lat: resolvedLat,
            lon: resolvedLon,
        };
    }

    const subDistrict = item.subDistrict || "-";
    const district = item.district || "-";
    const city = item.city || "-";
    const state = item.state || "-";
    const country = item.country || "Indonesia";
    const zipCode = item.zipCode || "-";
    const latLong =
        !isNaN(resolvedLat) && !isNaN(resolvedLon)
            ? `${Number(resolvedLat.toFixed(7))},${Number(resolvedLon.toFixed(7))}`
            : "-";

    const taxonomy = getIndonesianTelecomTaxonomy(state, city);

    return {
        inputAddr,
        status: "OK",
        subDistrict,
        district,
        city,
        state,
        country,
        zipCode,
        latLong,
        reg: taxonomy.reg,
        area: taxonomy.area,
        cluster: taxonomy.cluster,
        arep: taxonomy.arep,
        lat: isNaN(resolvedLat) ? undefined : resolvedLat,
        lon: isNaN(resolvedLon) ? undefined : resolvedLon,
    };
}

interface MapModalProps {
    isOpen: boolean;
    onClose: () => void;
    siteName: string;
    address?: string;
    latitude: number;
    longitude: number;
    isDarkMode: boolean;
    searchedLat?: number;
    searchedLon?: number;
    searchedName?: string;
}

function InteractiveMapModal({
    isOpen,
    onClose,
    siteName,
    address,
    latitude,
    longitude,
    isDarkMode,
    searchedLat,
    searchedLon,
    searchedName,
}: MapModalProps) {
    const mapRef = React.useRef<HTMLDivElement>(null);
    const [showRuler, setShowRuler] = React.useState(true);

    React.useEffect(() => {
        if (!isOpen || !mapRef.current) return;

        // Initialize leaflet map centered on the site
        const centerCoords: L.LatLngExpression = [latitude, longitude];
        const map = L.map(mapRef.current, {
            center: centerCoords,
            zoom: 15,
            zoomControl: false,
        });

        L.control.zoom({ position: "bottomright" }).addTo(map);

        const tileUrl = isDarkMode
            ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

        L.tileLayer(tileUrl, {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: "abcd",
            maxZoom: 20,
        }).addTo(map);

        // Destination/Opportunity site marker (Emerald)
        const customIcon = L.divIcon({
            className: "custom-leaflet-marker",
            html: `
                <div class="relative flex items-center justify-center">
                    <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-emerald-400 opacity-75"></span>
                    <div class="relative bg-emerald-600 text-white rounded-full p-2 shadow-xl border-2 border-white dark:border-slate-900">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.74a1.8 1.8 0 0 1-2.4 0C8.36 20.193 3 14.993 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    </div>
                </div>
            `,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
        });

        const destMarker = L.marker([latitude, longitude], {
            icon: customIcon,
        }).addTo(map);
        destMarker.bindTooltip(`Target: ${siteName}`, {
            permanent: true,
            direction: "top",
            className: "custom-leaflet-tooltip",
        });

        // Searched origin location marker and geodesic ruler line
        if (searchedLat !== undefined && searchedLon !== undefined) {
            const searchIcon = L.divIcon({
                className: "custom-leaflet-marker-search",
                html: `
                    <div class="relative flex items-center justify-center">
                        <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-rose-400 opacity-75"></span>
                        <div class="relative bg-rose-500 text-white rounded-full p-2 shadow-xl border-2 border-white dark:border-slate-900">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                        </div>
                    </div>
                `,
                iconSize: [32, 32],
                iconAnchor: [16, 16],
            });

            const searchMarker = L.marker([searchedLat, searchedLon], {
                icon: searchIcon,
            }).addTo(map);
            searchMarker.bindTooltip(searchedName || "Input Location", {
                permanent: true,
                direction: "top",
                className: "custom-leaflet-tooltip",
            });

            if (showRuler) {
                L.polyline(
                    [
                        [searchedLat, searchedLon],
                        [latitude, longitude],
                    ],
                    {
                        color: isDarkMode ? "#34d399" : "#059669",
                        weight: 3,
                        dashArray: "6, 8",
                        opacity: 0.9,
                    },
                ).addTo(map);

                const midLat = (searchedLat + latitude) / 2;
                const midLon = (searchedLon + longitude) / 2;
                const distanceKm = calculateDistance(
                    searchedLat,
                    searchedLon,
                    latitude,
                    longitude,
                );
                const distanceStr =
                    distanceKm < 1
                        ? `${(distanceKm * 1000).toFixed(0)} m`
                        : `${distanceKm.toFixed(2)} km`;

                L.tooltip({
                    permanent: true,
                    direction: "center",
                    className: "custom-ruler-tooltip",
                })
                    .setLatLng([midLat, midLon])
                    .setContent(`Distance: ${distanceStr}`)
                    .addTo(map);
            }

            const bounds = L.latLngBounds([
                [latitude, longitude],
                [searchedLat, searchedLon],
            ]);
            map.fitBounds(bounds, { padding: [60, 60] });
        }

        setTimeout(() => {
            map.invalidateSize();
        }, 150);

        return () => {
            map.remove();
        };
    }, [
        isOpen,
        latitude,
        longitude,
        searchedLat,
        searchedLon,
        searchedName,
        isDarkMode,
        showRuler,
    ]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
                    />

                    {/* Modal Content */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative w-full max-w-3xl bg-white dark:bg-[#14181F] rounded-[2.5rem] overflow-hidden shadow-2xl border border-slate-100 dark:border-slate-800 flex flex-col h-[560px]"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between shrink-0">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                        Proximity Radar • Indonesia Sites
                                    </span>
                                </div>
                                <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight leading-tight">
                                    {siteName}
                                </h3>
                                <p className="text-[11px] text-slate-400 mt-0.5">
                                    {address || `${latitude}, ${longitude}`}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2.5 bg-slate-50 dark:bg-white/5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Map Area */}
                        <div className="flex-1 relative bg-slate-100 dark:bg-[#0D1117]">
                            <div
                                ref={mapRef}
                                className="absolute inset-0 w-full h-full z-0"
                            />
                        </div>

                        {/* Footer Controls */}
                        <div className="p-4 bg-slate-50/90 dark:bg-[#1A1F26] border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between shrink-0 gap-3 text-xs">
                            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 font-semibold">
                                LAT/LON: {latitude.toFixed(6)},{" "}
                                {longitude.toFixed(6)}
                            </span>

                            {searchedLat !== undefined &&
                                searchedLon !== undefined && (
                                    <label className="flex items-center gap-2 cursor-pointer select-none text-[10px] font-black uppercase tracking-wider text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-3 py-1.5 rounded-full hover:border-emerald-500 transition-all shadow-xs">
                                        <input
                                            type="checkbox"
                                            checked={showRuler}
                                            onChange={(e) =>
                                                setShowRuler(e.target.checked)
                                            }
                                            className="rounded border-slate-300 dark:border-slate-700 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5 cursor-pointer accent-emerald-600"
                                        />
                                        <span>Direct Line Ruler</span>
                                    </label>
                                )}

                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                                    Active Geodesic Vector
                                </span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

export default function Geolocator({
    onBack,
    isDarkMode,
    toggleTheme,
}: {
    onBack: () => void;
    isDarkMode: boolean;
    toggleTheme: () => void;
}) {
    const [sites, setSites] = useState<Site[]>([]);
    const [activeMapSite, setActiveMapSite] = useState<{
        siteName: string;
        address?: string;
        latitude: number;
        longitude: number;
        searchedLat?: number;
        searchedLon?: number;
        searchedName?: string;
    } | null>(null);
    const [searchedLocation, setSearchedLocation] = useState<{
        lat: number;
        lon: number;
        label?: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [searchProgress, setSearchProgress] = useState<string | null>(null);
    const [results, setResults] = useState<{ site: Site; distance: number }[]>(
        [],
    );
    const [geocodeRows, setGeocodeRows] = useState<GeocodeResultRow[]>([]);
    const [activeResultTab, setActiveResultTab] = useState<
        "table" | "feasibility"
    >("table");
    const [isWideView, setIsWideView] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [engineInfo, setEngineInfo] = useState<{
        hasGoogleMapsKey: boolean;
        activeEngine: "google" | "osm";
    }>({
        hasGoogleMapsKey: false,
        activeEngine: "osm",
    });
    const [showApiInfoModal, setShowApiInfoModal] = useState(false);
    const [inputMode, setInputMode] = useState<"address" | "coords" | "bulk">(
        "address",
    );
    const [coords, setCoords] = useState({ lat: "", lon: "" });
    const [bulkInput, setBulkInput] = useState("");
    const [bulkResults, setBulkResults] = useState<
        {
            input: string;
            name?: string;
            nearest: Site;
            distance: number;
            error?: string;
            searchedLat?: number;
            searchedLon?: number;
        }[]
    >([]);

    const parseRawData = (data: any[]): Site[] => {
        return data
            .map((item) => {
                const normalized: any = {};
                Object.keys(item).forEach((key) => {
                    const cleanKey = key.toLowerCase().replace(/\s+/g, "");
                    normalized[cleanKey] = item[key];
                });

                const name =
                    normalized.name ||
                    normalized.sitename ||
                    normalized.site ||
                    normalized.sid ||
                    normalized.id ||
                    normalized.hostname ||
                    normalized.customer ||
                    normalized.label ||
                    (Object.keys(normalized).find(
                        (k) => k.includes("name") || k.includes("site"),
                    ) !== undefined
                        ? normalized[
                              Object.keys(normalized).find(
                                  (k) =>
                                      k.includes("name") || k.includes("site"),
                              )!
                          ]
                        : "Unknown Site");

                const latitude = parseFloat(
                    normalized.latitude ||
                        normalized.lat ||
                        normalized.y ||
                        normalized.latitud ||
                        "",
                );
                const longitude = parseFloat(
                    normalized.longitude ||
                        normalized.long ||
                        normalized.lon ||
                        normalized.x ||
                        normalized.longitud ||
                        "",
                );
                const address =
                    normalized.address ||
                    normalized.location ||
                    normalized.alamat ||
                    "";

                return {
                    name: String(name).trim(),
                    latitude,
                    longitude,
                    address: String(address).trim(),
                    ...item,
                };
            })
            .filter((site) => !isNaN(site.latitude) && !isNaN(site.longitude));
    };

    // Load sites with fallback and check geolocator engine status
    useEffect(() => {
        const loadSitesAndStatus = async () => {
            // Check Geolocator Engine status (Google Maps vs OSM)
            try {
                const statusRes = await fetch("/api/geolocator/status");
                if (statusRes.ok) {
                    const statusData = await statusRes.json();
                    setEngineInfo({
                        hasGoogleMapsKey: Boolean(statusData.hasGoogleMapsKey),
                        activeEngine: statusData.activeEngine || "osm",
                    });
                }
            } catch (err) {
                console.warn("Could not retrieve geolocator status:", err);
            }

            try {
                const response = await fetch("/geoloc/sites.xlsx");
                if (!response.ok) {
                    throw new Error(
                        `Failed to fetch: status ${response.status}`,
                    );
                }
                const arrayBuffer = await response.arrayBuffer();

                const bytes = new Uint8Array(arrayBuffer.slice(0, 4));
                const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
                if (!isZip) {
                    throw new Error("Fetched file is not a valid Excel file");
                }

                const workbook = XLSX.read(arrayBuffer, { type: "array" });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const data = XLSX.utils.sheet_to_json(worksheet) as any[];

                const parsedSites = parseRawData(data);
                if (parsedSites.length === 0) {
                    throw new Error("No valid sites found in parsed Excel.");
                }
                setSites(parsedSites);
            } catch (err) {
                console.warn(
                    "Failed to fetch dynamic sites.xlsx, loading static Indonesia sites fallback:",
                    err,
                );
                const parsedSites = parseRawData(SITES_FALLBACK);
                setSites(parsedSites);
            } finally {
                setLoading(false);
            }
        };

        loadSitesAndStatus();
    }, []);

    const findNearestSites = useCallback(
        (lat: number, lon: number, label?: string) => {
            const calculated = sites.map((site) => ({
                site,
                distance: calculateDistance(
                    lat,
                    lon,
                    site.latitude,
                    site.longitude,
                ),
            }));

            calculated.sort((a, b) => a.distance - b.distance);
            setResults(calculated.slice(0, 5));
            setSearchedLocation({ lat, lon, label });
        },
        [sites],
    );

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSearching(true);
        setError(null);
        setSearchProgress(null);
        setResults([]);
        setBulkResults([]);
        setGeocodeRows([]);
        setSearchedLocation(null);

        try {
            if (inputMode === "address") {
                if (!searchQuery.trim()) return;
                setSearchProgress(
                    engineInfo.hasGoogleMapsKey
                        ? "Querying Google Maps Indonesian Administrative Registry..."
                        : "Querying Indonesian administrative boundaries...",
                );

                // Fetch geocoded result via backend (Google Maps Geocoding API if key configured, else OSM)
                let data: any = null;
                try {
                    const apiRes = await fetch(
                        `/api/geolocator/geocode?q=${encodeURIComponent(searchQuery.trim())}`,
                    );
                    if (apiRes.ok) {
                        data = await apiRes.json();
                    }
                } catch (err) {
                    console.warn(
                        "Backend geocode endpoint failed, falling back to direct OSM search:",
                        err,
                    );
                }

                // Fallback to direct client-side OSM if backend unavailable
                if (!data) {
                    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=id&viewbox=94.8,6.2,141.2,-11.2&bounded=0&q=${encodeURIComponent(
                        searchQuery.trim(),
                    )}&limit=1`;
                    const res = await fetch(url, {
                        headers: { "Accept-Language": "id,en;q=0.9" },
                    });
                    const osmData = await res.json();
                    if (osmData && osmData.length > 0) {
                        const parsed = parseNominatimAddress(
                            searchQuery.trim(),
                            osmData[0],
                            parseFloat(osmData[0].lat),
                            parseFloat(osmData[0].lon),
                        );
                        data = { results: [parsed] };
                    }
                }

                if (data && data.results && data.results.length > 0) {
                    const item = data.results[0];
                    const lat = parseFloat(item.lat);
                    const lon = parseFloat(item.lon);

                    if (!isWithinIndonesia(lat, lon)) {
                        const outsideRow = formatGeocodeResult(
                            searchQuery.trim(),
                            item,
                            lat,
                            lon,
                        );
                        outsideRow.status = "OUTSIDE INDONESIA";
                        setGeocodeRows([outsideRow]);
                        setError(
                            "Location is outside Indonesia. Searches are restricted to Indonesian areas only.",
                        );
                        setActiveResultTab("table");
                    } else {
                        const parsedRow = formatGeocodeResult(
                            searchQuery.trim(),
                            item,
                            lat,
                            lon,
                        );
                        setGeocodeRows([parsedRow]);
                        findNearestSites(lat, lon, searchQuery.trim());
                        setActiveResultTab("table");
                    }
                } else {
                    const notFoundRow = formatGeocodeResult(
                        searchQuery.trim(),
                        null,
                    );
                    setGeocodeRows([notFoundRow]);
                    setError(
                        "Address not found in Indonesia. Please verify spelling or landmark name.",
                    );
                    setActiveResultTab("table");
                }
            } else if (inputMode === "coords") {
                const lat = parseFloat(coords.lat.replace(",", "."));
                const lon = parseFloat(coords.lon.replace(",", "."));
                if (isNaN(lat) || isNaN(lon)) {
                    setError("Please enter valid coordinates.");
                    return;
                }

                // Check geographic boundaries of Indonesia
                if (!isWithinIndonesia(lat, lon)) {
                    const outsideRow: GeocodeResultRow = {
                        inputAddr: `${lat}, ${lon}`,
                        status: "OUTSIDE INDONESIA",
                        subDistrict: "-",
                        district: "-",
                        city: "-",
                        state: "-",
                        country: "Outside Indonesia",
                        zipCode: "-",
                        latLong: `${lat}, ${lon}`,
                        reg: "-",
                        area: "-",
                        cluster: "-",
                        arep: "-",
                        lat,
                        lon,
                    };
                    setGeocodeRows([outsideRow]);
                    setError(
                        "Coordinates are outside Indonesia. Only Indonesian coordinates are accepted.",
                    );
                    setActiveResultTab("table");
                    return;
                }

                setSearchProgress(
                    "Reverse geocoding Indonesian coordinates...",
                );
                let parsedRow: GeocodeResultRow;
                try {
                    const revRes = await fetch(
                        `/api/geolocator/reverse?lat=${lat}&lon=${lon}`,
                    );
                    if (revRes.ok) {
                        const revData = await revRes.json();
                        parsedRow = formatGeocodeResult(
                            `${lat}, ${lon}`,
                            revData.result,
                            lat,
                            lon,
                        );
                    } else {
                        parsedRow = formatGeocodeResult(
                            `${lat}, ${lon}`,
                            null,
                            lat,
                            lon,
                        );
                        parsedRow.status = "OK";
                    }
                } catch {
                    parsedRow = formatGeocodeResult(
                        `${lat}, ${lon}`,
                        null,
                        lat,
                        lon,
                    );
                    parsedRow.status = "OK";
                }
                setGeocodeRows([parsedRow]);
                findNearestSites(lat, lon, `Coordinates: ${lat}, ${lon}`);
                setActiveResultTab("table");
            } else if (inputMode === "bulk") {
                const lines = bulkInput
                    .split("\n")
                    .map((l) => l.trim())
                    .filter((l) => l.length > 0);

                if (lines.length === 0) return;

                const batchBulk: typeof bulkResults = [];
                const batchGeocode: GeocodeResultRow[] = [];

                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i];
                    setSearchProgress(
                        `Processing location ${i + 1} of ${lines.length}...`,
                    );

                    const coordRegex =
                        /(-?\d+[,.]\d+)\s*[\s,;\t]+\s*(-?\d+[,.]\d+)/;
                    const coordsMatch = line.match(coordRegex);

                    if (coordsMatch) {
                        const lat = parseFloat(
                            coordsMatch[1].replace(",", "."),
                        );
                        const lon = parseFloat(
                            coordsMatch[2].replace(",", "."),
                        );
                        const namePart = line.split(coordsMatch[0])[0].trim();
                        const siteName =
                            namePart.replace(/[,;\t]+$/, "").trim() ||
                            undefined;

                        if (!isWithinIndonesia(lat, lon)) {
                            const outsideRow: GeocodeResultRow = {
                                inputAddr: siteName || line,
                                status: "OUTSIDE INDONESIA",
                                subDistrict: "-",
                                district: "-",
                                city: "-",
                                state: "-",
                                country: "Outside ID",
                                zipCode: "-",
                                latLong: `${lat}, ${lon}`,
                                reg: "-",
                                area: "-",
                                cluster: "-",
                                arep: "-",
                                lat,
                                lon,
                            };
                            batchGeocode.push(outsideRow);
                            batchBulk.push({
                                input: line,
                                name: siteName,
                                nearest: sites[0] || {
                                    name: "N/A",
                                    latitude: 0,
                                    longitude: 0,
                                },
                                distance: 0,
                                error: "Outside Indonesia",
                                searchedLat: lat,
                                searchedLon: lon,
                            });
                        } else {
                            let row: GeocodeResultRow;
                            try {
                                const revRes = await fetch(
                                    `/api/geolocator/reverse?lat=${lat}&lon=${lon}`,
                                );
                                if (revRes.ok) {
                                    const revData = await revRes.json();
                                    row = formatGeocodeResult(
                                        siteName || line,
                                        revData.result,
                                        lat,
                                        lon,
                                    );
                                } else {
                                    row = formatGeocodeResult(
                                        siteName || line,
                                        null,
                                        lat,
                                        lon,
                                    );
                                    row.status = "OK";
                                }
                            } catch {
                                row = formatGeocodeResult(
                                    siteName || line,
                                    null,
                                    lat,
                                    lon,
                                );
                                row.status = "OK";
                            }
                            batchGeocode.push(row);

                            let nearest = sites[0];
                            let minDistance =
                                sites.length > 0
                                    ? calculateDistance(
                                          lat,
                                          lon,
                                          sites[0].latitude,
                                          sites[0].longitude,
                                      )
                                    : 0;

                            for (let j = 1; j < sites.length; j++) {
                                const d = calculateDistance(
                                    lat,
                                    lon,
                                    sites[j].latitude,
                                    sites[j].longitude,
                                );
                                if (d < minDistance) {
                                    minDistance = d;
                                    nearest = sites[j];
                                }
                            }

                            batchBulk.push({
                                input: line,
                                name: siteName,
                                nearest,
                                distance: minDistance,
                                searchedLat: lat,
                                searchedLon: lon,
                            });
                        }
                    } else {
                        // Forward geocode
                        try {
                            const apiRes = await fetch(
                                `/api/geolocator/geocode?q=${encodeURIComponent(line)}`,
                            );
                            let searchData: any = null;
                            if (apiRes.ok) {
                                searchData = await apiRes.json();
                            }

                            if (
                                searchData &&
                                searchData.results &&
                                searchData.results.length > 0
                            ) {
                                const item = searchData.results[0];
                                const lat = parseFloat(item.lat);
                                const lon = parseFloat(item.lon);

                                if (!isWithinIndonesia(lat, lon)) {
                                    const row = formatGeocodeResult(
                                        line,
                                        item,
                                        lat,
                                        lon,
                                    );
                                    row.status = "OUTSIDE INDONESIA";
                                    batchGeocode.push(row);
                                    batchBulk.push({
                                        input: line,
                                        nearest: sites[0] || {
                                            name: "N/A",
                                            latitude: 0,
                                            longitude: 0,
                                        },
                                        distance: 0,
                                        error: "Outside Indonesia",
                                    });
                                } else {
                                    const row = formatGeocodeResult(
                                        line,
                                        item,
                                        lat,
                                        lon,
                                    );
                                    batchGeocode.push(row);

                                    let nearest = sites[0];
                                    let minDistance =
                                        sites.length > 0
                                            ? calculateDistance(
                                                  lat,
                                                  lon,
                                                  sites[0].latitude,
                                                  sites[0].longitude,
                                              )
                                            : 0;

                                    for (let j = 1; j < sites.length; j++) {
                                        const d = calculateDistance(
                                            lat,
                                            lon,
                                            sites[j].latitude,
                                            sites[j].longitude,
                                        );
                                        if (d < minDistance) {
                                            minDistance = d;
                                            nearest = sites[j];
                                        }
                                    }

                                    batchBulk.push({
                                        input: line,
                                        name: line,
                                        nearest,
                                        distance: minDistance,
                                        searchedLat: lat,
                                        searchedLon: lon,
                                    });
                                }
                            } else {
                                const row = formatGeocodeResult(line, null);
                                batchGeocode.push(row);
                                batchBulk.push({
                                    input: line,
                                    nearest: sites[0] || {
                                        name: "N/A",
                                        latitude: 0,
                                        longitude: 0,
                                    },
                                    distance: 0,
                                    error: "Not found in ID",
                                });
                            }
                        } catch {
                            const row = formatGeocodeResult(line, null);
                            batchGeocode.push(row);
                            batchBulk.push({
                                input: line,
                                nearest: sites[0] || {
                                    name: "N/A",
                                    latitude: 0,
                                    longitude: 0,
                                },
                                distance: 0,
                                error: "Geocoding error",
                            });
                        }
                    }

                    if (i < lines.length - 1) {
                        await sleep(150);
                    }
                }

                setGeocodeRows(batchGeocode);
                setBulkResults(batchBulk);
                setActiveResultTab("table");
            }
        } catch (err) {
            setError(
                "Search failed. Please check network connection and try again.",
            );
        } finally {
            setIsSearching(false);
            setSearchProgress(null);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center p-8 transition-colors text-center font-sans">
                <Loader2 className="w-12 h-12 text-emerald-600 dark:text-emerald-400 animate-spin mb-6" />
                <p className="text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest text-xs">
                    Synthesizing Indonesian Geospatial Network Data...
                </p>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col p-6 md:p-12 transition-colors font-sans overflow-x-hidden">
            {/* Top Navigation Header */}
            <header className="max-w-6xl mx-auto w-full flex items-center justify-between mb-8 md:mb-12">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onBack}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
                        id="back-button"
                    >
                        <ArrowRight className="w-5 h-5 rotate-180" />
                    </button>
                    <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <MapPin className="w-6 h-6 text-white" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                                Geolocator
                            </h1>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">
                            Site Feasibility & Proximity Engine
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setShowApiInfoModal(true)}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border transition-all cursor-pointer ${
                            engineInfo.hasGoogleMapsKey
                                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                : "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800/40 hover:border-amber-400"
                        }`}
                        id="api-engine-badge-button"
                        title="Click to view Geocoding API Engine & Pricing Details"
                    >
                        {engineInfo.hasGoogleMapsKey ? (
                            <>
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span>Google Maps API (Active)</span>
                            </>
                        ) : (
                            <>
                                <Info className="w-3.5 h-3.5 text-amber-500" />
                                <span>OSM Nominatim (Free)</span>
                            </>
                        )}
                    </button>

                    <button
                        onClick={toggleTheme}
                        className="p-2.5 bg-slate-100 dark:bg-slate-800/50 rounded-xl text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400 transition-all border border-slate-100 dark:border-slate-700 cursor-pointer"
                        id="theme-toggle-button"
                    >
                        {isDarkMode ? (
                            <Sun className="w-5 h-5" />
                        ) : (
                            <Moon className="w-5 h-5" />
                        )}
                    </button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 flex-1 mb-12 items-start">
                {/* Search Parameters Section */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                    <div className="bg-white dark:bg-[#14181F] p-6 md:p-8 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm transition-colors flex flex-col">
                        <div className="flex items-center justify-between mb-6 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-950/60 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                    <Search className="w-4 h-4" />
                                </div>
                                <div>
                                    <h2 className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">
                                        Search Parameters
                                    </h2>
                                </div>
                            </div>
                        </div>

                        <div>
                            {/* Segmented Mode Selector */}
                            <div className="mb-6 p-1.5 bg-slate-50 dark:bg-[#1A1F26] rounded-2xl border border-slate-100 dark:border-slate-800">
                                <div className="grid grid-cols-3 gap-1 relative">
                                    {(
                                        ["address", "coords", "bulk"] as const
                                    ).map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            onClick={() => setInputMode(mode)}
                                            className={`relative z-10 py-2.5 rounded-[12px] text-[10px] font-black transition-colors cursor-pointer uppercase ${
                                                inputMode === mode
                                                    ? "text-emerald-600 dark:text-emerald-400"
                                                    : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                                            }`}
                                        >
                                            {mode === "address"
                                                ? "Address"
                                                : mode === "coords"
                                                  ? "Coords"
                                                  : "Batch"}
                                            {inputMode === mode && (
                                                <motion.div
                                                    layoutId="active-input-mode-bg"
                                                    className="absolute inset-0 bg-white dark:bg-[#14181F] shadow-sm border border-slate-100 dark:border-slate-800 rounded-[12px] -z-10"
                                                    transition={{
                                                        type: "spring",
                                                        bounce: 0.2,
                                                        duration: 0.5,
                                                    }}
                                                />
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <form onSubmit={handleSearch} className="space-y-5">
                                {inputMode === "address" ? (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between px-1">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                                                Address / Landmark
                                            </label>
                                        </div>
                                        <div className="relative group">
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                                            <input
                                                type="text"
                                                value={searchQuery}
                                                onChange={(e) =>
                                                    setSearchQuery(
                                                        e.target.value,
                                                    )
                                                }
                                                placeholder="e.g. Jl. Jend. Sudirman, Jakarta Selatan..."
                                                className="w-full h-11 pl-11 pr-10 bg-slate-50 dark:bg-[#1A1F26] border border-slate-200 dark:border-slate-800 rounded-2xl text-sm transition-all focus:ring-4 focus:ring-emerald-50 dark:focus:ring-emerald-950/30 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 font-medium text-slate-900 dark:text-slate-100"
                                            />
                                            {searchQuery && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setSearchQuery("")
                                                    }
                                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ) : inputMode === "coords" ? (
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">
                                                    Latitude
                                                </label>
                                                <input
                                                    type="text"
                                                    value={coords.lat}
                                                    onChange={(e) =>
                                                        setCoords({
                                                            ...coords,
                                                            lat: e.target.value,
                                                        })
                                                    }
                                                    placeholder="-6.2088"
                                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-[#1A1F26] border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-mono transition-all focus:ring-4 focus:ring-emerald-50 dark:focus:ring-emerald-950/30 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 text-slate-900 dark:text-slate-100"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block px-1">
                                                    Longitude
                                                </label>
                                                <input
                                                    type="text"
                                                    value={coords.lon}
                                                    onChange={(e) =>
                                                        setCoords({
                                                            ...coords,
                                                            lon: e.target.value,
                                                        })
                                                    }
                                                    placeholder="106.8456"
                                                    className="w-full h-11 px-4 bg-slate-50 dark:bg-[#1A1F26] border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-mono transition-all focus:ring-4 focus:ring-emerald-50 dark:focus:ring-emerald-950/30 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 text-slate-900 dark:text-slate-100"
                                                />
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 px-1 font-medium">
                                            Valid Indonesian coordinates range
                                            between Lat: -11.0° to 6.1° and Lon:
                                            95.0° to 141.0°.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between px-1">
                                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">
                                                Batch Locations
                                            </label>
                                            <span className="text-[9px] font-bold text-slate-400">
                                                One per line
                                            </span>
                                        </div>
                                        <textarea
                                            value={bulkInput}
                                            onChange={(e) =>
                                                setBulkInput(e.target.value)
                                            }
                                            placeholder={`Jakarta Pusat -6.1818 106.8223\nSurabaya Gubeng -7.2654 112.7519\nBandung Dago -6.8797 107.6186\nJl. Malioboro Yogyakarta`}
                                            rows={6}
                                            wrap="off"
                                            className="w-full p-4 bg-slate-50 dark:bg-[#1A1F26] border border-slate-200 dark:border-slate-800 rounded-2xl text-xs transition-all focus:ring-4 focus:ring-emerald-50 dark:focus:ring-emerald-950/30 focus:border-emerald-600 dark:focus:border-emerald-500 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 font-mono text-slate-900 dark:text-slate-100 leading-relaxed resize-none overflow-x-auto custom-scrollbar"
                                        />
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 px-1 font-medium">
                                            Accepts either address lines or Site
                                            Name followed by Lat Long in
                                            Indonesia.
                                        </p>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={
                                        isSearching ||
                                        (inputMode === "address" &&
                                            !searchQuery.trim()) ||
                                        (inputMode === "coords" &&
                                            (!coords.lat.trim() ||
                                                !coords.lon.trim())) ||
                                        (inputMode === "bulk" &&
                                            !bulkInput.trim())
                                    }
                                    className="w-full h-12 bg-slate-900 dark:bg-emerald-600 hover:bg-black dark:hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800/80 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded-2xl font-black text-xs shadow-lg shadow-slate-900/10 dark:shadow-emerald-900/20 transition-all flex items-center justify-center gap-2.5 active:scale-[0.98] cursor-pointer uppercase tracking-wider"
                                    id="analyze-feasibility-button"
                                >
                                    {isSearching ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span>
                                                Analyzing Indonesia Grid...
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <Navigation className="w-4 h-4" />
                                            <span>Analyze Feasibility</span>
                                        </>
                                    )}
                                </button>
                            </form>

                            {searchProgress && (
                                <motion.div
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 rounded-2xl flex items-center gap-2.5 text-emerald-700 dark:text-emerald-300 text-xs font-semibold"
                                >
                                    <Loader2 className="w-4 h-4 animate-spin shrink-0 text-emerald-600 dark:text-emerald-400" />
                                    <span>{searchProgress}</span>
                                </motion.div>
                            )}

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-2xl flex items-center gap-2.5 text-rose-700 dark:text-rose-300 text-xs font-bold"
                                >
                                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                                    <span>{error}</span>
                                </motion.div>
                            )}
                        </div>
                    </div>

                    {/* Database Stats Card */}
                    <div className="bg-white dark:bg-[#14181F] p-6 rounded-3xl border border-slate-100 dark:border-slate-800 shadow-sm flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                <Radio className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    Active Provider Edge Devices
                                </h3>
                                <div className="text-sm font-black text-slate-900 dark:text-white">
                                    PE Sites
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-2xl font-black text-slate-900 dark:text-white">
                                {sites.length}
                            </span>
                            <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                Registered Nodes
                            </div>
                        </div>
                    </div>
                </div>

                {/* Results Section */}
                <div
                    className={`${
                        isWideView ? "lg:col-span-12" : "lg:col-span-7"
                    } relative min-h-[600px] bg-white dark:bg-[#14181F] border border-slate-100 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col transition-all duration-300 overflow-hidden`}
                >
                    <AnimatePresence mode="wait">
                        {geocodeRows.length > 0 ||
                        bulkResults.length > 0 ||
                        results.length > 0 ? (
                            <motion.div
                                key="results-view"
                                initial={{ opacity: 0, scale: 0.99 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.99 }}
                                className="flex flex-col h-full w-full overflow-hidden"
                            >
                                {/* Results Tab Switcher & Full-Width Controller */}
                                <div className="flex flex-wrap items-center justify-between gap-3 mb-6 shrink-0 border-b border-slate-100 dark:border-slate-800/80 pb-4">
                                    <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-[#1A1F26] rounded-2xl border border-slate-200/50 dark:border-slate-800">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setActiveResultTab("table")
                                            }
                                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                activeResultTab === "table"
                                                    ? "bg-white dark:bg-[#14181F] text-emerald-600 dark:text-emerald-400 shadow-sm"
                                                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                                            }`}
                                        >
                                            <TableProperties className="w-3.5 h-3.5" />
                                            <span>Results Table</span>
                                            {geocodeRows.length > 0 && (
                                                <span className="px-1.5 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px]">
                                                    {geocodeRows.length}
                                                </span>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setActiveResultTab(
                                                    "feasibility",
                                                )
                                            }
                                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                                                activeResultTab ===
                                                "feasibility"
                                                    ? "bg-white dark:bg-[#14181F] text-emerald-600 dark:text-emerald-400 shadow-sm"
                                                    : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                                            }`}
                                        >
                                            <Layers className="w-3.5 h-3.5" />
                                            <span>Nearest Sites</span>
                                            {(bulkResults.length > 0 ||
                                                results.length > 0) && (
                                                <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-[10px]">
                                                    {bulkResults.length > 0
                                                        ? bulkResults.length
                                                        : results.length}
                                                </span>
                                            )}
                                        </button>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setIsWideView(!isWideView)
                                            }
                                            className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 dark:bg-[#1A1F26] border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-all cursor-pointer shadow-xs"
                                            title={
                                                isWideView
                                                    ? "Collapse view"
                                                    : "Expand full width"
                                            }
                                        >
                                            {isWideView ? (
                                                <>
                                                    <Minimize2 className="w-3.5 h-3.5" />
                                                    <span>Standard</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Maximize2 className="w-3.5 h-3.5" />
                                                    <span>Wide View</span>
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-hidden flex flex-col">
                                    {activeResultTab === "table" ? (
                                        <div className="flex-1 flex flex-col overflow-hidden">
                                            <GeocodeResultTable
                                                rows={geocodeRows}
                                                onSelectRow={(row) => {
                                                    if (
                                                        row.lat !== undefined &&
                                                        row.lon !== undefined
                                                    ) {
                                                        const nearest =
                                                            sites.length > 0
                                                                ? sites.reduce(
                                                                      (
                                                                          prev,
                                                                          curr,
                                                                      ) => {
                                                                          const dCurr =
                                                                              calculateDistance(
                                                                                  row.lat!,
                                                                                  row.lon!,
                                                                                  curr.latitude,
                                                                                  curr.longitude,
                                                                              );
                                                                          const dPrev =
                                                                              calculateDistance(
                                                                                  row.lat!,
                                                                                  row.lon!,
                                                                                  prev.latitude,
                                                                                  prev.longitude,
                                                                              );
                                                                          return dCurr <
                                                                              dPrev
                                                                              ? curr
                                                                              : prev;
                                                                      },
                                                                  )
                                                                : null;

                                                        setActiveMapSite({
                                                            siteName: nearest
                                                                ? nearest.name
                                                                : row.inputAddr ||
                                                                  "Searched Location",
                                                            address: nearest
                                                                ? nearest.address
                                                                : `${row.district || row.subDistrict || ""}, ${row.city || ""}`,
                                                            latitude: nearest
                                                                ? nearest.latitude
                                                                : row.lat,
                                                            longitude: nearest
                                                                ? nearest.longitude
                                                                : row.lon,
                                                            searchedLat:
                                                                row.lat,
                                                            searchedLon:
                                                                row.lon,
                                                            searchedName:
                                                                row.inputAddr,
                                                        });
                                                    }
                                                }}
                                            />
                                        </div>
                                    ) : bulkResults.length > 0 ? (
                                        <div className="flex flex-col h-full overflow-hidden">
                                            <div className="flex items-center justify-between mb-4 shrink-0">
                                                <div>
                                                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">
                                                        Batch Proximity Summary
                                                    </h3>
                                                    <p className="text-[10px] text-slate-400 font-medium">
                                                        Nearest Indonesian
                                                        telecommunications sites
                                                        calculated
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const wb =
                                                            XLSX.utils.book_new();
                                                        const exportData =
                                                            bulkResults.map(
                                                                (r) => ({
                                                                    "Input Site":
                                                                        r.name ||
                                                                        "Unnamed",
                                                                    "Input Raw":
                                                                        r.input,
                                                                    "Nearest Site":
                                                                        r.error
                                                                            ? "Format Error"
                                                                            : r
                                                                                  .nearest
                                                                                  .name,
                                                                    "Distance (km)":
                                                                        r.error
                                                                            ? "-"
                                                                            : r.distance.toFixed(
                                                                                  3,
                                                                              ),
                                                                    "Site Latitude":
                                                                        r.error
                                                                            ? "-"
                                                                            : r
                                                                                  .nearest
                                                                                  .latitude,
                                                                    "Site Longitude":
                                                                        r.error
                                                                            ? "-"
                                                                            : r
                                                                                  .nearest
                                                                                  .longitude,
                                                                    Status:
                                                                        r.error ||
                                                                        "Computed",
                                                                }),
                                                            );
                                                        const ws =
                                                            XLSX.utils.json_to_sheet(
                                                                exportData,
                                                            );
                                                        XLSX.utils.book_append_sheet(
                                                            wb,
                                                            ws,
                                                            "Batch Results",
                                                        );
                                                        XLSX.writeFile(
                                                            wb,
                                                            "Batch_Indonesia_Sites_Analysis.xlsx",
                                                        );
                                                    }}
                                                    className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm active:scale-95"
                                                >
                                                    <Download className="w-3.5 h-3.5" />
                                                    <span>Export XLSX</span>
                                                </button>
                                            </div>

                                            <div className="space-y-3 overflow-y-auto pr-1.5 custom-scrollbar flex-1 pb-2">
                                                {bulkResults.map((res, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{
                                                            opacity: 0,
                                                            y: 15,
                                                        }}
                                                        animate={{
                                                            opacity: 1,
                                                            y: 0,
                                                        }}
                                                        transition={{
                                                            delay: i * 0.04,
                                                        }}
                                                        className="bg-slate-50 dark:bg-[#1A1F26] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/40 transition-all"
                                                    >
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="min-w-0 flex-1">
                                                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                                                    {res.name && (
                                                                        <span className="px-2 py-0.5 bg-white dark:bg-slate-900 rounded-md text-[9px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider border border-slate-200 dark:border-slate-800">
                                                                            {
                                                                                res.name
                                                                            }
                                                                        </span>
                                                                    )}
                                                                    <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">
                                                                        {res.input
                                                                            .replace(
                                                                                res.name ||
                                                                                    "",
                                                                                "",
                                                                            )
                                                                            .trim()}
                                                                    </p>
                                                                </div>

                                                                {res.error ? (
                                                                    <div className="flex items-center gap-2 text-rose-500">
                                                                        <AlertCircle className="w-3.5 h-3.5" />
                                                                        <span className="text-[10px] font-black uppercase tracking-widest">
                                                                            {
                                                                                res.error
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="space-y-3">
                                                                        <div className="flex flex-col gap-0.5">
                                                                            <div className="flex items-center gap-2">
                                                                                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                                                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight break-words">
                                                                                    {
                                                                                        res
                                                                                            .nearest
                                                                                            .name
                                                                                    }
                                                                                </h4>
                                                                            </div>
                                                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium pl-4 line-clamp-1">
                                                                                {res
                                                                                    .nearest
                                                                                    .address ||
                                                                                    `${res.nearest.latitude}, ${res.nearest.longitude}`}
                                                                            </p>
                                                                        </div>

                                                                        <div className="flex items-center gap-4 pl-4">
                                                                            <div className="flex items-baseline gap-1.5">
                                                                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                                                                    Distance:
                                                                                </span>
                                                                                <span className="text-sm font-black text-slate-900 dark:text-white">
                                                                                    {res.distance <
                                                                                    1
                                                                                        ? `${(res.distance * 1000).toFixed(0)} m`
                                                                                        : `${res.distance.toFixed(2)} km`}
                                                                                </span>
                                                                            </div>
                                                                            <span className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 rounded-full">
                                                                                Feasible
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {!res.error && (
                                                                <button
                                                                    onClick={() =>
                                                                        setActiveMapSite(
                                                                            {
                                                                                siteName:
                                                                                    res
                                                                                        .nearest
                                                                                        .name,
                                                                                address:
                                                                                    res
                                                                                        .nearest
                                                                                        .address,
                                                                                latitude:
                                                                                    res
                                                                                        .nearest
                                                                                        .latitude,
                                                                                longitude:
                                                                                    res
                                                                                        .nearest
                                                                                        .longitude,
                                                                                searchedLat:
                                                                                    res.searchedLat,
                                                                                searchedLon:
                                                                                    res.searchedLon,
                                                                                searchedName:
                                                                                    res.name ||
                                                                                    res.input,
                                                                            },
                                                                        )
                                                                    }
                                                                    className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500 transition-all shrink-0 cursor-pointer shadow-xs"
                                                                    title="View Map Connection"
                                                                >
                                                                    <MapIcon className="w-4 h-4" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col h-full overflow-hidden">
                                            <div className="flex items-center justify-between mb-4 shrink-0">
                                                <div>
                                                    <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-widest">
                                                        Top Proximity
                                                        Opportunities
                                                    </h3>
                                                    <p className="text-[10px] text-slate-400 font-medium">
                                                        Nearest active network
                                                        nodes in Indonesia
                                                    </p>
                                                </div>
                                                <div className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40 rounded-full text-[10px] font-black uppercase tracking-widest">
                                                    Optimal Link
                                                </div>
                                            </div>

                                            <div className="space-y-3 overflow-y-auto pr-1.5 custom-scrollbar flex-1 pb-2">
                                                {results.map((res, i) => (
                                                    <motion.div
                                                        key={`${res.site.name}-${res.site.latitude}-${res.site.longitude}-${i}`}
                                                        initial={{
                                                            opacity: 0,
                                                            y: 15,
                                                        }}
                                                        animate={{
                                                            opacity: 1,
                                                            y: 0,
                                                        }}
                                                        transition={{
                                                            delay: i * 0.08,
                                                        }}
                                                        className="group bg-slate-50 dark:bg-[#1A1F26] p-5 rounded-2xl border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/40 transition-all"
                                                    >
                                                        <div className="flex items-start justify-between gap-4">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                                                                    <h4 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight break-words">
                                                                        {
                                                                            res
                                                                                .site
                                                                                .name
                                                                        }
                                                                    </h4>
                                                                </div>
                                                                <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mb-3 leading-relaxed whitespace-normal break-words pl-4">
                                                                    {res.site
                                                                        .address ||
                                                                        `${res.site.latitude}, ${res.site.longitude}`}
                                                                </p>
                                                                <div className="flex items-center gap-4 pl-4">
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                                                            Distance
                                                                        </span>
                                                                        <span className="text-base font-black text-slate-900 dark:text-white">
                                                                            {res.distance <
                                                                            1
                                                                                ? `${(res.distance * 1000).toFixed(0)} m`
                                                                                : `${res.distance.toFixed(2)} km`}
                                                                        </span>
                                                                    </div>
                                                                    <div className="w-px h-6 bg-slate-200 dark:bg-slate-800" />
                                                                    <div className="flex flex-col">
                                                                        <span className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                                                            Status
                                                                        </span>
                                                                        <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                                                                            Serviceable
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() =>
                                                                    setActiveMapSite(
                                                                        {
                                                                            siteName:
                                                                                res
                                                                                    .site
                                                                                    .name,
                                                                            address:
                                                                                res
                                                                                    .site
                                                                                    .address,
                                                                            latitude:
                                                                                res
                                                                                    .site
                                                                                    .latitude,
                                                                            longitude:
                                                                                res
                                                                                    .site
                                                                                    .longitude,
                                                                            searchedLat:
                                                                                searchedLocation?.lat,
                                                                            searchedLon:
                                                                                searchedLocation?.lon,
                                                                            searchedName:
                                                                                searchedLocation?.label,
                                                                        },
                                                                    )
                                                                }
                                                                className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500 transition-all cursor-pointer shadow-xs"
                                                                title="View on Map"
                                                            >
                                                                <MapIcon className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ) : (
                            <motion.div
                                key="empty-view"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="h-full w-full flex flex-col items-center justify-center text-center p-8 my-auto"
                            >
                                <div className="w-16 h-16 bg-slate-100 dark:bg-[#1A1F26] rounded-2xl flex items-center justify-center mb-4 text-slate-400 dark:text-slate-600 border border-slate-200/60 dark:border-slate-800">
                                    <Compass className="w-8 h-8" />
                                </div>
                                <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight mb-1">
                                    Awaiting Location
                                </h3>
                                <p className="text-[11px] font-medium text-slate-400 max-w-[280px] leading-relaxed">
                                    Enter address, landmark, or coordinates to
                                    calculate nearest feasibility and breakdown.
                                </p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </main>

            <InteractiveMapModal
                isOpen={activeMapSite !== null}
                onClose={() => setActiveMapSite(null)}
                siteName={activeMapSite?.siteName || ""}
                address={activeMapSite?.address}
                latitude={activeMapSite?.latitude || 0}
                longitude={activeMapSite?.longitude || 0}
                searchedLat={activeMapSite?.searchedLat}
                searchedLon={activeMapSite?.searchedLon}
                searchedName={activeMapSite?.searchedName}
                isDarkMode={isDarkMode}
            />

            {/* Google Maps Platform API Info Modal */}
            <AnimatePresence>
                {showApiInfoModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
                        onClick={() => setShowApiInfoModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0, y: 10 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.95, opacity: 0, y: 10 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white dark:bg-[#14181F] rounded-3xl p-6 md:p-8 max-w-lg w-full border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6"
                        >
                            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                        <Compass className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-base font-black text-slate-900 dark:text-white uppercase tracking-tight">
                                            Geocoding Provider Engine
                                        </h3>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                                            Indonesia Telecommunication Map &
                                            Proximity
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setShowApiInfoModal(false)}
                                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4 text-xs text-slate-600 dark:text-slate-300">
                                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-slate-800 dark:text-slate-200">
                                            Active Engine:
                                        </span>
                                        <span
                                            className={`font-black uppercase tracking-wider px-2 py-0.5 rounded-full text-[10px] ${
                                                engineInfo.hasGoogleMapsKey
                                                    ? "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                                                    : "bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300"
                                            }`}
                                        >
                                            {engineInfo.hasGoogleMapsKey
                                                ? "Google Maps Platform Geocoding API"
                                                : "OpenStreetMap Nominatim (Free Fallback)"}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                        {engineInfo.hasGoogleMapsKey
                                            ? "Google Maps API is active. Queries and coordinates are resolved using Google's official Indonesian database."
                                            : "No Google Maps key detected in environment. The app is running on OpenStreetMap Nominatim with strict Indonesian boundaries and automatic fallback."}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <span>
                                            Is Google Maps Geocoding API Paid?
                                        </span>
                                    </h4>
                                    <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-900/40 text-[11px] space-y-1.5 text-slate-700 dark:text-slate-300">
                                        <p>
                                            <strong className="text-emerald-700 dark:text-emerald-400">
                                                Yes, but with a generous Free
                                                Tier:
                                            </strong>{" "}
                                            Google Maps Platform provides{" "}
                                            <strong>
                                                $200 free monthly credit
                                            </strong>{" "}
                                            to every billing account.
                                        </p>
                                        <ul className="list-disc pl-4 space-y-1 text-slate-600 dark:text-slate-400">
                                            <li>
                                                Geocoding costs{" "}
                                                <strong>
                                                    $5.00 per 1,000 requests
                                                </strong>{" "}
                                                (0.005 USD per search).
                                            </li>
                                            <li>
                                                With the $200 free credit, you
                                                get up to{" "}
                                                <strong>
                                                    40,000 free geocoding
                                                    searches every month
                                                </strong>
                                                .
                                            </li>
                                            <li>
                                                You only pay if your usage
                                                exceeds 40,000 requests in a
                                                single calendar month.
                                            </li>
                                        </ul>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h4 className="font-bold text-slate-900 dark:text-white">
                                        How to enable your Google Maps key:
                                    </h4>
                                    <ol className="list-decimal pl-4 space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                                        <li>
                                            Obtain an API key from Google Cloud
                                            Console with Geocoding API enabled.
                                        </li>
                                        <li>
                                            Add{" "}
                                            <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                                                GOOGLE_MAPS_PLATFORM_KEY
                                            </code>{" "}
                                            to your project secrets in the AI
                                            Studio Settings menu.
                                        </li>
                                        <li>
                                            The app will automatically switch to
                                            Google Maps resolution with zero
                                            downtime.
                                        </li>
                                    </ol>
                                </div>
                            </div>

                            <div className="pt-2 flex justify-end">
                                <button
                                    onClick={() => setShowApiInfoModal(false)}
                                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
                                >
                                    Got It
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
