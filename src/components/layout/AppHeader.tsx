import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { IconButton } from "../ui/Button";
import { ThemeToggle } from "../ui/ThemeToggle";
import { containerClass, type ContainerWidth } from "./container";

interface AppHeaderProps {
    title: string;
    subtitle?: string;
    /** Logo or <AppIcon>, shown before the title. */
    icon?: ReactNode;
    /** Shows a back button when provided. */
    onBack?: () => void;
    /** Extra controls, rendered before the theme toggle. */
    actions?: ReactNode;
    /** Match the width of the page content below. */
    width?: ContainerWidth;
}

/** Top bar shared by the dashboard, the generator menu and every app. */
export function AppHeader({
    title,
    subtitle,
    icon,
    onBack,
    actions,
    width = "default",
}: AppHeaderProps) {
    return (
        <header className="border-b border-slate-200 bg-white dark:border-white/10 dark:bg-[#151A22]">
            <div
                className={cn(
                    containerClass(width),
                    "flex h-16 items-center justify-between gap-4",
                )}
            >
                <div className="flex min-w-0 items-center gap-3">
                    {onBack && (
                        <IconButton label="Back" onClick={onBack}>
                            <ArrowLeft className="h-4 w-4" />
                        </IconButton>
                    )}
                    {icon}
                    <div className="min-w-0">
                        <h1 className="truncate text-base font-semibold leading-tight text-slate-900 dark:text-slate-100">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                                {subtitle}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {actions}
                    <ThemeToggle />
                </div>
            </div>
        </header>
    );
}
