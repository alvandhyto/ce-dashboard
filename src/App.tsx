import { AnimatePresence } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";

import {
    APPS,
    DASHBOARD_ROUTE,
    isProtectedRoute,
    parentRoute,
} from "./core/registry";
import type { Route } from "./core/types";
import { PageTransition } from "./components/layout/PageTransition";
import { ThemeProvider } from "./hooks/useTheme";
import { useAccessGate } from "./hooks/useAccessGate";
import { AccessGatePage } from "./pages/AccessGatePage";
import { DashboardPage } from "./pages/DashboardPage";
import { GeneratorsPage } from "./pages/GeneratorsPage";

export default function App() {
    return (
        <ThemeProvider>
            <Router />
        </ThemeProvider>
    );
}

function Router() {
    const [route, setRoute] = useState<Route>(DASHBOARD_ROUTE);
    const gate = useAccessGate();
    const protectedRoute = isProtectedRoute(route);

    // Leaving the generator area locks it again.
    const { lock } = gate;
    useEffect(() => {
        if (!protectedRoute) lock();
    }, [protectedRoute, lock]);

    const view = renderRoute();

    function renderRoute(): { key: string; node: ReactNode } {
        if (protectedRoute && !gate.unlocked) {
            return {
                key: "gate",
                node: (
                    <AccessGatePage
                        onSubmit={gate.unlock}
                        onCancel={() => setRoute(DASHBOARD_ROUTE)}
                    />
                ),
            };
        }

        switch (route.name) {
            case "dashboard":
                return {
                    key: "dashboard",
                    node: <DashboardPage onOpen={setRoute} />,
                };

            case "generators":
                return {
                    key: "generators",
                    node: (
                        <GeneratorsPage
                            onOpen={setRoute}
                            onBack={() => setRoute(DASHBOARD_ROUTE)}
                        />
                    ),
                };

            case "app": {
                const app = APPS[route.appId];
                const AppComponent = app.component;
                return {
                    key: `app:${app.id}`,
                    node: (
                        <AppComponent
                            onBack={() => setRoute(parentRoute(app.section))}
                        />
                    ),
                };
            }
        }
    }

    return (
        <AnimatePresence mode="wait">
            <PageTransition key={view.key}>{view.node}</PageTransition>
        </AnimatePresence>
    );
}
