import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
    const app = express();
    const PORT = 3000;

    app.use(express.json());

    // Geolocator Engine & Status Endpoints
    const getGoogleMapsApiKey = () => {
        return (
            process.env.GOOGLE_MAPS_PLATFORM_KEY ||
            process.env.GOOGLE_MAPS_API_KEY ||
            ""
        );
    };

    app.get("/api/geolocator/status", (req, res) => {
        const key = getGoogleMapsApiKey();
        res.json({
            hasGoogleMapsKey: Boolean(key && key !== "YOUR_API_KEY"),
            activeEngine: Boolean(key && key !== "YOUR_API_KEY")
                ? "google"
                : "osm",
        });
    });

    app.get("/api/geolocator/geocode", async (req, res) => {
        const query = ((req.query.q as string) || "").trim();
        if (!query) {
            return res
                .status(400)
                .json({ error: "Query parameter 'q' is required" });
        }

        const apiKey = getGoogleMapsApiKey();

        if (apiKey && apiKey !== "YOUR_API_KEY") {
            try {
                // Query Google Maps Geocoding API with Indonesia restrictions
                const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
                    query,
                )}&components=country:ID&region=id&language=id&key=${apiKey}`;

                const gResponse = await fetch(gUrl);
                const gData = await gResponse.json();

                if (
                    gData.status === "OK" &&
                    gData.results &&
                    gData.results.length > 0
                ) {
                    const parsedResults = gData.results.map((item: any) => {
                        const comps: { [type: string]: string } = {};
                        (item.address_components || []).forEach((c: any) => {
                            (c.types || []).forEach((t: string) => {
                                comps[t] = c.long_name;
                            });
                        });

                        return {
                            provider: "google",
                            formattedAddress: item.formatted_address,
                            lat: item.geometry?.location?.lat,
                            lon: item.geometry?.location?.lng,
                            subDistrict:
                                comps["administrative_area_level_3"] ||
                                comps["locality"] ||
                                "-",
                            district:
                                comps["administrative_area_level_4"] ||
                                comps["sublocality_level_1"] ||
                                comps["neighborhood"] ||
                                "-",
                            city:
                                comps["administrative_area_level_2"] ||
                                comps["administrative_area_level_1"] ||
                                "-",
                            state: comps["administrative_area_level_1"] || "-",
                            country: comps["country"] || "Indonesia",
                            zipCode: comps["postal_code"] || "-",
                        };
                    });

                    return res.json({
                        provider: "google",
                        status: "OK",
                        results: parsedResults,
                    });
                } else if (gData.status === "ZERO_RESULTS") {
                    return res.json({
                        provider: "google",
                        status: "ZERO_RESULTS",
                        results: [],
                    });
                } else {
                    console.warn(
                        "Google Maps Geocode returned status:",
                        gData.status,
                        gData.error_message,
                    );
                    // Fall back to OSM if Google Geocode returned an API key or billing error
                }
            } catch (err) {
                console.error(
                    "Google Geocode API error, falling back to OSM:",
                    err,
                );
            }
        }

        // Fallback: OpenStreetMap Nominatim with strict Indonesia bounds
        try {
            const osmUrl = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=id&viewbox=94.8,6.2,141.2,-11.2&bounded=0&q=${encodeURIComponent(
                query,
            )}&limit=5`;

            const osmRes = await fetch(osmUrl, {
                headers: {
                    "User-Agent": "GeolocatorApp/1.0",
                    "Accept-Language": "id,en;q=0.9",
                },
            });
            const osmData = await osmRes.json();

            const parsedResults = (osmData || []).map((item: any) => {
                const addr = item.address || {};
                const subDistrict =
                    addr.city_district ||
                    addr.subdistrict ||
                    addr.county ||
                    addr.municipality ||
                    addr.district ||
                    "-";
                const district =
                    addr.suburb ||
                    addr.village ||
                    addr.quarter ||
                    addr.neighbourhood ||
                    addr.residential ||
                    "-";
                let city =
                    addr.city ||
                    addr.regency ||
                    addr.state_district ||
                    addr.municipality ||
                    addr.county ||
                    "-";
                const state = addr.state || addr.province || addr.region || "-";
                const country = addr.country || "Indonesia";
                const zipCode = addr.postcode || addr.postal_code || "-";
                const lat = parseFloat(item.lat);
                const lon = parseFloat(item.lon);

                return {
                    provider: "osm",
                    formattedAddress: item.display_name,
                    lat,
                    lon,
                    subDistrict,
                    district,
                    city,
                    state,
                    country,
                    zipCode,
                };
            });

            return res.json({
                provider: "osm",
                status: parsedResults.length > 0 ? "OK" : "ZERO_RESULTS",
                results: parsedResults,
            });
        } catch (err: any) {
            return res.status(500).json({
                error: "Failed to geocode query",
                details: err.message,
            });
        }
    });

    app.get("/api/geolocator/reverse", async (req, res) => {
        const lat = parseFloat(req.query.lat as string);
        const lon = parseFloat(req.query.lon as string);
        if (isNaN(lat) || isNaN(lon)) {
            return res.status(400).json({
                error: "Valid 'lat' and 'lon' parameters are required",
            });
        }

        const apiKey = getGoogleMapsApiKey();

        if (apiKey && apiKey !== "YOUR_API_KEY") {
            try {
                const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&language=id&key=${apiKey}`;
                const gResponse = await fetch(gUrl);
                const gData = await gResponse.json();

                if (
                    gData.status === "OK" &&
                    gData.results &&
                    gData.results.length > 0
                ) {
                    const item = gData.results[0];
                    const comps: { [type: string]: string } = {};
                    (item.address_components || []).forEach((c: any) => {
                        (c.types || []).forEach((t: string) => {
                            comps[t] = c.long_name;
                        });
                    });

                    return res.json({
                        provider: "google",
                        status: "OK",
                        result: {
                            provider: "google",
                            formattedAddress: item.formatted_address,
                            lat,
                            lon,
                            subDistrict:
                                comps["administrative_area_level_3"] ||
                                comps["locality"] ||
                                "-",
                            district:
                                comps["administrative_area_level_4"] ||
                                comps["sublocality_level_1"] ||
                                comps["neighborhood"] ||
                                "-",
                            city:
                                comps["administrative_area_level_2"] ||
                                comps["administrative_area_level_1"] ||
                                "-",
                            state: comps["administrative_area_level_1"] || "-",
                            country: comps["country"] || "Indonesia",
                            zipCode: comps["postal_code"] || "-",
                        },
                    });
                }
            } catch (err) {
                console.error(
                    "Google Reverse Geocode error, falling back to OSM:",
                    err,
                );
            }
        }

        // Fallback OSM
        try {
            const osmUrl = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lon}`;
            const osmRes = await fetch(osmUrl, {
                headers: {
                    "User-Agent": "GeolocatorApp/1.0",
                    "Accept-Language": "id,en;q=0.9",
                },
            });
            const osmData = await osmRes.json();
            const addr = osmData?.address || {};

            const subDistrict =
                addr.city_district ||
                addr.subdistrict ||
                addr.county ||
                addr.municipality ||
                addr.district ||
                "-";
            const district =
                addr.suburb ||
                addr.village ||
                addr.quarter ||
                addr.neighbourhood ||
                addr.residential ||
                "-";
            const city =
                addr.city ||
                addr.regency ||
                addr.state_district ||
                addr.municipality ||
                addr.county ||
                "-";
            const state = addr.state || addr.province || addr.region || "-";
            const country = addr.country || "Indonesia";
            const zipCode = addr.postcode || addr.postal_code || "-";

            return res.json({
                provider: "osm",
                status: "OK",
                result: {
                    provider: "osm",
                    formattedAddress: osmData?.display_name || `${lat}, ${lon}`,
                    lat,
                    lon,
                    subDistrict,
                    district,
                    city,
                    state,
                    country,
                    zipCode,
                },
            });
        } catch (err: any) {
            return res.status(500).json({
                error: "Failed to reverse geocode",
                details: err.message,
            });
        }
    });

    // Speedtest Endpoints
    app.get("/api/speedtest/getIP", (req, res) => {
        const clientIp =
            req.headers["x-forwarded-for"] || req.socket.remoteAddress;
        const ip = Array.isArray(clientIp)
            ? clientIp[0]
            : clientIp?.split(",")[0] || clientIp;
        res.json({ ip });
    });

    app.get("/api/speedtest/empty", (req, res) => {
        res.set(
            "Cache-Control",
            "no-store, no-cache, must-revalidate, max-age=0",
        );
        res.set("Access-Control-Allow-Origin", "*");
        res.send();
    });

    // Handle large uploads by NOT parsing the body
    app.post("/api/speedtest/empty", (req, res) => {
        // Consume the stream without parsing it to body
        req.on("data", () => {});
        req.on("end", () => {
            res.set(
                "Cache-Control",
                "no-store, no-cache, must-revalidate, max-age=0",
            );
            res.set("Access-Control-Allow-Origin", "*");
            res.send();
        });
    });

    app.get("/api/speedtest/garbage", (req, res) => {
        res.set("Content-Description", "File Transfer");
        res.set("Content-Type", "application/octet-stream");
        res.set("Content-Disposition", "attachment; filename=random.dat");
        res.set("Content-Transfer-Encoding", "binary");
        res.set(
            "Cache-Control",
            "no-store, no-cache, must-revalidate, max-age=0",
        );
        res.set("Access-Control-Allow-Origin", "*");

        const chunkSize = 1024 * 1024; // 1MB
        const chunk = Buffer.alloc(chunkSize, "0");
        const ckSize = parseInt(req.query.ckSize as string) || 100;
        const totalSize = ckSize * 1024 * 1024;

        let bytesSent = 0;
        function send() {
            while (bytesSent < totalSize) {
                bytesSent += chunkSize;
                const isDrained = res.write(chunk);
                if (!isDrained) {
                    res.once("drain", send);
                    return;
                }
            }
            res.end();
        }
        send();
    });

    // Catch-all for API to prevent HTML responses
    app.all("/api/*", (req, res) => {
        res.status(404).json({ error: "API Route Not Found", path: req.path });
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), "dist");
        app.use(express.static(distPath));
        app.get("*", (req, res) => {
            res.sendFile(path.join(distPath, "index.html"));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
