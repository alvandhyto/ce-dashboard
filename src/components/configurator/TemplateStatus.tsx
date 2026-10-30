import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface TemplateStatusProps {
    status: "loading" | "ready" | "error";
    /** Human-readable template name, usually its file name. */
    name: string;
    error?: string | null;
    onRetry: () => void;
}

/** One-line feedback about the template the generator will fill in. */
export function TemplateStatus({ status, name, error, onRetry }: TemplateStatusProps) {
    if (status === "loading") {
        return (
            <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400" role="status">
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                Loading {name}
            </p>
        );
    }

    if (status === "error") {
        return (
            <div
                role="alert"
                className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-900 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-100"
            >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0 flex-1">
                    <p className="font-medium">Couldn't load {name}</p>
                    {error ? <p className="mt-0.5 break-words opacity-90">{error}</p> : null}
                </div>
                <button
                    type="button"
                    onClick={onRetry}
                    className="shrink-0 cursor-pointer font-medium underline underline-offset-2 hover:no-underline"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="min-w-0 truncate">{name} loaded</span>
        </p>
    );
}
