import { AnimatePresence, LazyMotion } from "motion/react";
import { Suspense, useEffect, type ReactNode } from "react";

import {
    APPS,
    DASHBOARD_ROUTE,
    isProtectedRoute,
    parentRoute,
    routeTitle,
} from "./core/registry";
import { PageTransition } from "./components/layout/PageTransition";
import { ThemeProvider } from "./hooks/useTheme";
import { useAccessGate } from "./hooks/useAccessGate";
import { useHashRoute } from "./hooks/useHashRoute";
import { AccessGatePage } from "./pages/AccessGatePage";
import { DashboardPage } from "./pages/DashboardPage";
import { GeneratorsPage } from "./pages/GeneratorsPage";

/** Keeps Motion's animation code out of the first download; components use `m.*`, not `motion.*`. */
const loadMotionFeatures = () => import("./lib/motionFeatures").then((mod) => mod.default);

export default function App() {
    return (
        <ThemeProvider>
            <LazyMotion features={loadMotionFeatures} strict>
                <Router />
            </LazyMotion>
        </ThemeProvider>
    );
}

function Router() {
    const [route, setRoute] = useHashRoute();
    const gate = useAccessGate();
    const protectedRoute = isProtectedRoute(route);

    // Leaving the generator area locks it again.
    const { lock } = gate;
    useEffect(() => {
        if (!protectedRoute) lock();
    }, [protectedRoute, lock]);

    useEffect(() => {
        document.title = routeTitle(route);
    }, [route]);

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
                    // Apps load on demand; the blank moment before the first one arrives is brief.
                    node: (
                        <Suspense fallback={null}>
                            <AppComponent
                                onBack={() => setRoute(parentRoute(app.section))}
                            />
                        </Suspense>
                    ),
                };
            }
        }
    }

    return (
        // initial={false}: the first page shows at once, without waiting for the animation code.
        // Each new page starts at the top rather than at the old page's scroll position.
        <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo(0, 0)}>
            <PageTransition key={view.key}>{view.node}</PageTransition>
        </AnimatePresence>
    );
}
