/**
 * The one place that knows which apps exist.
 *
 * To add an app: build it under tools/ or configurators/, add its id to AppId in
 * types.ts, then add one entry to APPS below. The dashboard, the generator menu,
 * navigation and the access gate all read from here.
 */
import { Folder, Gauge, Terminal } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import PlaceholderApp from "../tools/placeholder";
import SpeedtestApp from "../tools/speedtest";
import FortigateConfigurator from "../configurators/fortigate";
import KfcConfigurator from "../configurators/kfc";
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
        component: SpeedtestApp,
    },
    placeholder: {
        id: "placeholder",
        title: "Placeholder",
        description:
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
        icon: <Folder className="h-5 w-5" />,
        accent: "amber",
        section: "main",
        component: PlaceholderApp,
    },
    fortigate: {
        id: "fortigate",
        title: "FortiGate",
        description: "FortiGate firewall standardized configuration.",
        icon: <img src="/icons/fortilogo.ico" alt="" className="h-6 w-6" />,
        accent: "rose",
        section: "generators",
        component: FortigateConfigurator,
    },
    kfc: {
        id: "kfc",
        title: "KFC FortiGate",
        description:
            "KFC branch configuration for the Project Replace Fortigate 50E: 40F, 30G, and 30G with a switch.",
        icon: <img src="/icons/kfclogo.png" alt="" className="h-6 w-6" />,
        accent: "rose",
        section: "generators",
        component: KfcConfigurator,
    },
};

const launcherFor = (app: AppDefinition): Launcher => ({
    key: app.id,
    title: app.title,
    description: app.description,
    icon: app.icon,
    accent: app.accent,
    route: { name: "app", appId: app.id },
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
export const GENERATORS_ROUTE: Route = { name: "generators" };

/** Where "Back" leads from an app. */
export const parentRoute = (section: Section): Route =>
    section === "generators" ? GENERATORS_ROUTE : DASHBOARD_ROUTE;

/** True for the generator menu and every app in the "generators" section. */
export function isProtectedRoute(route: Route): boolean {
    if (route.name === "generators") return true;
    return route.name === "app" && APPS[route.appId].section === "generators";
}
