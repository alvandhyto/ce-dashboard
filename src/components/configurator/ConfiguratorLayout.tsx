import { Terminal } from "lucide-react";
import { useEffect, type FormEvent, type ReactNode } from "react";
import type { ToastMessage } from "../../hooks/useToast";
import type { Accent } from "../../lib/accent";
import { cn } from "../../lib/cn";
import { AppHeader } from "../layout/AppHeader";
import { AppShell } from "../layout/AppShell";
import { containerClass } from "../layout/container";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";
import { Toast } from "../ui/Toast";
import { ResetButton } from "./ResetButton";

interface ConfiguratorLayoutProps {
    title: string;
    subtitle: string;
    /** Path of the customer or vendor logo under /public. */
    logo: string;
    onBack: () => void;
    onReset: () => void;
    /** The form has typing that leaving would lose: Back and closing the tab ask first. */
    dirty: boolean;
    /** Called on submit; the default browser submit is already prevented. */
    onGenerate: () => void;
    generateLabel?: string;
    /** False while the template is loading or failed to load. */
    ready: boolean;
    accent?: Accent;
    toast: ToastMessage | null;
    onDismissToast: () => void;
    /** The form sections, inside the Parameters panel. */
    children: ReactNode;
    /** Right column: the generated output. */
    preview: ReactNode;
}

/**
 * The page every configurator uses: header with Back and Reset, the parameters form on the
 * left with Generate at the bottom, the preview on the right, and the toast.
 * On large screens it fills the viewport and each column scrolls on its own;
 * on small screens the columns stack and the page scrolls.
 */
export function ConfiguratorLayout({
    title,
    subtitle,
    logo,
    onBack,
    onReset,
    dirty,
    onGenerate,
    generateLabel = "Generate Configuration",
    ready,
    accent,
    toast,
    onDismissToast,
    children,
    preview,
}: ConfiguratorLayoutProps) {
    // Closing the tab, reloading or typing another address: the browser shows its own prompt.
    useEffect(() => {
        if (!dirty) return;
        const warn = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    const handleBack = () => {
        if (!dirty || window.confirm("Leave this generator? The parameters you entered will be lost.")) onBack();
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        onGenerate();
    };

    return (
        <AppShell fillViewport>
            <AppHeader
                title={title}
                subtitle={subtitle}
                icon={<img src={logo} alt="" width={32} height={32} className="h-8 w-8 shrink-0" />}
                onBack={handleBack}
                actions={<ResetButton onReset={onReset} />}
            />
            <main
                className={cn(
                    containerClass("wide"),
                    "grid min-h-0 flex-1 gap-6 py-4 sm:py-6 lg:grid-cols-[440px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]",
                )}
            >
                <form noValidate onSubmit={handleSubmit} className="flex min-h-0 flex-col">
                    <Panel
                        title="Parameters"
                        bodyClassName="divide-y divide-slate-200 dark:divide-white/10"
                        footer={
                            <Button
                                type="submit"
                                variant="primary"
                                accent={accent}
                                size="lg"
                                className="w-full uppercase"
                                icon={<Terminal className="h-4 w-4" />}
                                disabled={!ready}
                            >
                                {generateLabel}
                            </Button>
                        }
                    >
                        {children}
                    </Panel>
                </form>
                <div className="flex h-[60vh] min-h-[360px] flex-col lg:h-auto">{preview}</div>
            </main>
            <Toast toast={toast} onDismiss={onDismissToast} />
        </AppShell>
    );
}
