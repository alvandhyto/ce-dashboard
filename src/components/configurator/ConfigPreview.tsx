import { memo, useMemo } from "react";
import { Check, Copy, Download, FileCode, Terminal } from "lucide-react";
import { useCopyToClipboard } from "../../hooks/useCopyToClipboard";
import { cn } from "../../lib/cn";
import { downloadTextFile } from "../../lib/download";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";

/** How a line should be coloured. Each vendor supplies its own classifier. */
export type LineKind = "keyword" | "setting" | "end" | "comment" | "plain";

/**
 * - empty:    nothing generated yet
 * - current:  output matches the parameters on screen
 * - outdated: parameters changed after the output was generated
 */
export type PreviewState = "empty" | "current" | "outdated";

const KIND_CLASS: Record<LineKind, string> = {
    keyword: "font-medium text-rose-700 dark:text-rose-400",
    setting: "text-slate-800 dark:text-slate-200",
    end: "text-slate-400 dark:text-slate-500",
    comment: "italic text-slate-400 dark:text-slate-500",
    plain: "text-slate-600 dark:text-slate-400",
};

const STATE_META: Record<PreviewState, { dot: string; label: string }> = {
    empty: { dot: "bg-slate-300 dark:bg-slate-600", label: "Nothing generated yet" },
    current: { dot: "bg-emerald-500", label: "Matches the current parameters" },
    outdated: { dot: "bg-amber-500", label: "Parameters changed since this was generated" },
};

const plainClassifier = (): LineKind => "plain";

const ConfigLine = memo(function ConfigLine({
    number,
    text,
    kind,
}: {
    number: number;
    text: string;
    kind: LineKind;
}) {
    return (
        <div className="flex px-2 hover:bg-slate-100/70 dark:hover:bg-white/5">
            <span
                aria-hidden
                className="w-12 shrink-0 select-none pr-4 text-right text-slate-400 dark:text-slate-600"
            >
                {number}
            </span>
            <span className={cn("whitespace-pre", KIND_CLASS[kind])}>{text}</span>
        </div>
    );
});

function formatBytes(bytes: number): string {
    return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;
}

interface ConfigPreviewProps {
    filename: string;
    content: string | null;
    state: PreviewState;
    classifyLine?: (line: string) => LineKind;
}

export function ConfigPreview({
    filename,
    content,
    state,
    classifyLine = plainClassifier,
}: ConfigPreviewProps) {
    const { status: copyStatus, copy } = useCopyToClipboard();

    const lines = useMemo(() => {
        if (!content) return [];
        const split = content.split(/\r?\n/);
        if (split[split.length - 1] === "") split.pop();
        return split;
    }, [content]);

    const sizeLabel = useMemo(
        () => (content ? formatBytes(new TextEncoder().encode(content).length) : ""),
        [content],
    );

    const meta = STATE_META[state];

    const actions = content ? (
        <>
            <Button
                size="sm"
                icon={copyStatus === "copied" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                onClick={() => copy(content)}
            >
                {copyStatus === "copied" ? "Copied" : copyStatus === "failed" ? "Copy failed" : "Copy"}
            </Button>
            <Button
                size="sm"
                icon={<Download className="h-3.5 w-3.5" />}
                onClick={() => downloadTextFile(content, filename)}
            >
                Download
            </Button>
        </>
    ) : null;

    return (
        <Panel
            title={
                <span className="flex min-w-0 items-center gap-2 font-mono text-[13px] font-medium">
                    <FileCode className="h-4 w-4 shrink-0 text-slate-400" />
                    <span className="truncate">{filename}</span>
                </span>
            }
            actions={actions}
            bodyClassName="bg-white dark:bg-[#0B0E14]"
            footerClassName="py-2.5"
            footer={
                <div className="flex items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span className="flex min-w-0 items-center gap-2" aria-live="polite">
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} />
                        <span className="truncate">{meta.label}</span>
                    </span>
                    {content && (
                        <span className="flex shrink-0 gap-4 font-mono">
                            <span>{lines.length} lines</span>
                            <span>{sizeLabel}</span>
                        </span>
                    )}
                </div>
            }
        >
            {content ? (
                <div
                    role="region"
                    aria-label="Generated configuration"
                    tabIndex={0}
                    className="h-full overflow-auto py-3 font-mono text-[13px] leading-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-400/50"
                >
                    <div className="min-w-max">
                        {lines.map((line, index) => (
                            <ConfigLine key={index} number={index + 1} text={line} kind={classifyLine(line)} />
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                    <Terminal className="h-6 w-6 text-slate-300 dark:text-slate-600" />
                    <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            No configuration yet
                        </p>
                        <p className="mt-1 max-w-xs text-sm text-slate-500 dark:text-slate-400">
                            Fill in the parameters, then select Generate config.
                        </p>
                    </div>
                </div>
            )}
        </Panel>
    );
}
