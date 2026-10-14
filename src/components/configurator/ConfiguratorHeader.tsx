import { ArrowLeft, Moon, RotateCcw, Sun } from "lucide-react";
import { Button, IconButton } from "../ui/Button";

interface ConfiguratorHeaderProps {
    title: string;
    subtitle?: string;
    logoSrc?: string;
    logoAlt?: string;
    onBack: () => void;
    onReset: () => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
}

export function ConfiguratorHeader({
    title,
    subtitle,
    logoSrc,
    logoAlt = "",
    onBack,
    onReset,
    isDarkMode,
    onToggleTheme,
}: ConfiguratorHeaderProps) {
    return (
        <header className="border-b border-slate-200 bg-white dark:border-white/10 dark:bg-[#151A22]">
            <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                    <IconButton label="Back" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4" />
                    </IconButton>
                    {logoSrc && <img src={logoSrc} alt={logoAlt} className="h-8 w-8 shrink-0" />}
                    <div className="min-w-0">
                        <h1 className="truncate text-base font-semibold leading-tight text-slate-900 dark:text-slate-100">
                            {title}
                        </h1>
                        {subtitle && (
                            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
                        )}
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    <Button size="md" icon={<RotateCcw className="h-4 w-4" />} onClick={onReset}>
                        Reset
                    </Button>
                    <IconButton
                        label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
                        onClick={onToggleTheme}
                    >
                        {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </IconButton>
                </div>
            </div>
        </header>
    );
}
