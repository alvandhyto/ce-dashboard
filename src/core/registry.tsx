/**
 * The one place that knows which apps exist.
 *
 * To add an app: build it under tools/ or configurators/, add its id to AppId in
 * types.ts, then add one entry to APPS below. The dashboard, the generator menu,
 * navigation and the access gate all read from here.
 *
 * Each app is its own chunk, downloaded when it is first opened (or when its card is
 * hovered or focused, so it is usually there by the click). The dashboard doesn't carry them.
 */
import { Folder, Gauge, Terminal } from "lucide-react";
import { lazy, type ComponentType, type ReactNode } from "react";

import type { Accent } from "../lib/accent";
import type { AppId, AppProps, Route, Section } from "./types";

export interface AppDefinition {
    id: AppId;
    title: string;
    description: string;
    icon: ReactNode;
    accent: Accent;
    section: Section;
    component: ComponentType<AppProps>;
    /** Starts downloading the app's chunk. Safe to call any number of times. */
    preload: () => void;
}

/** What a dashboard or menu card links to. */
export interface Launcher {
    key: string;
    title: string;
    description: string;
    icon: ReactNode;
    accent: Accent;
    route: Route;
    restricted?: boolean;
    preload?: () => void;
}

/** An app loaded on demand. The browser fetches a module once, so preloading twice costs nothing. */
function onDemand(load: () => Promise<{ default: ComponentType<AppProps> }>) {
    return { component: lazy(load), preload: () => void load() };
}

export const APPS: Record<AppId, AppDefinition> = {
    speedtest: {
        id: "speedtest",
        title: "Speedtest",
        description:
            "This speedtest application delivers accurate, real-time measurement of internet performance, including latency, jitter, download speed, upload speed.",
        icon: <Gauge className="h-5 w-5" />,
        accent: "blue",
        section: "main",
        ...onDemand(() => import("../tools/speedtest/SpeedtestApp")),
    },
    placeholder: {
        id: "placeholder",
        title: "Placeholder",
        description:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        icon: <Folder className="h-5 w-5" />,
        accent: "amber",
        section: "main",
        ...onDemand(() => import("../tools/placeholder/PlaceholderApp")),
    },
    fortigate: {
        id: "fortigate",
        title: "FortiGate",
        description: "FortiGate firewall standardized configuration.",
        icon: <img src="/icons/fortilogo.ico" alt="" className="h-6 w-6" />,
        accent: "rose",
        section: "generators",
        ...onDemand(() => import("../configurators/fortigate/FortigateConfigurator")),
    },
    kfc: {
        id: "kfc",
        title: "KFC FortiGate",
        description:
            "KFC branch configuration for the Project Replace Fortigate 50E: 40F, 30G, and 30G with a switch.",
        icon: <img src="/icons/kfclogo.png" alt="" className="h-6 w-6" />,
        accent: "rose",
        section: "generators",
        ...onDemand(() => import("../configurators/kfc/KfcConfigurator")),
    },
    chatime: {
        id: "chatime",
        title: "Chatime FortiGate",
        description:
            "Chatime branch configuration for the Project Replace Versa: 40F and 30G.",
        icon: <img src="/icons/chatimelogo.png" alt="" className="h-6 w-6" />,
        accent: "violet",
        section: "generators",
        ...onDemand(() => import("../configurators/chatime/ChatimeConfigurator")),
    },
};

const launcherFor = (app: AppDefinition): Launcher => ({
    key: app.id,
    title: app.title,
    description: app.description,
    icon: app.icon,
    accent: app.accent,
    route: { name: "app", appId: app.id },
    preload: app.preload,
});

/** Card that opens the generator menu (which sits behind the access gate). */
const GENERATORS_LAUNCHER: Launcher = {
    key: "generators",
    title: "Generators",
    description:
        "Reliable tools designed to generate standardized configurations, ensuring consistency and operational efficiency.",
    icon: <Terminal className="h-5 w-5" />,
    accent: "rose",
    route: { name: "generators" },
    restricted: true,
};

/** Dashboard order: Speedtest, Generators, then the rest. */
export const DASHBOARD_LAUNCHERS: Launcher[] = [
    launcherFor(APPS.speedtest),
    GENERATORS_LAUNCHER,
    launcherFor(APPS.placeholder),
];

export const GENERATOR_LAUNCHERS: Launcher[] = Object.values(APPS)
    .filter((app) => app.section === "generators")
    .map(launcherFor);

export const DASHBOARD_ROUTE: Route = { name: "dashboard" };
const GENERATORS_ROUTE: Route = { name: "generators" };

/** Where "Back" leads from an app. */
export const parentRoute = (section: Section): Route =>
    section === "generators" ? GENERATORS_ROUTE : DASHBOARD_ROUTE;

/** The URL hash for a route: "" for the dashboard, "#/generators", "#/<appId>". */
export function routeToHash(route: Route): string {
    if (route.name === "dashboard") return "";
    return route.name === "generators" ? "#/generators" : `#/${route.appId}`;
}

/** The route a URL hash points to. Anything unknown is the dashboard. */
export function routeFromHash(hash: string): Route {
    const path = hash.replace(/^#\/?/, "");
    if (path === "generators") return GENERATORS_ROUTE;
    if (Object.hasOwn(APPS, path)) return { name: "app", appId: path as AppId };
    return DASHBOARD_ROUTE;
}

const SITE_TITLE = "Dashboard Delivery";

/** The browser tab title for a route. */
export function routeTitle(route: Route): string {
    if (route.name === "dashboard") return SITE_TITLE;
    const page = route.name === "generators" ? GENERATORS_LAUNCHER.title : APPS[route.appId].title;
    return `${page} · ${SITE_TITLE}`;
}

/** True for the generator menu and every app in the "generators" section. */
export function isProtectedRoute(route: Route): boolean {
    if (route.name === "generators") return true;
    return route.name === "app" && APPS[route.appId].section === "generators";
}
