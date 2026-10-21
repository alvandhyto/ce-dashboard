import { memo, useState } from "react";
import { Download } from "lucide-react";
import { downloadTextFiles, type TextFile } from "../../lib/download";
import type { LineKind } from "../../lib/syntax";
import { Button } from "../ui/Button";
import { SegmentedControl } from "../ui/SegmentedControl";
import { ConfigPreview, type PreviewState } from "./ConfigPreview";

export interface GeneratedFile extends TextFile {
    /** Stable key for the tab, e.g. "cpe". */
    id: string;
    /** Short name on the tab, e.g. "CPE". */
    label: string;
}

interface MultiConfigPreviewProps {
    files: readonly GeneratedFile[];
    /** Shown before anything has been generated. */
    emptyFilename: string;
    state: PreviewState;
    classifyLine?: (line: string) => LineKind;
}

/**
 * ConfigPreview for configurators that produce more than one file. With a
 * single file it looks exactly like ConfigPreview; with several, tabs pick
 * the file on show and "Download all" saves them together.
 */
export const MultiConfigPreview = memo(function MultiConfigPreview({
    files,
    emptyFilename,
    state,
    classifyLine,
}: MultiConfigPreviewProps) {
    const [activeId, setActiveId] = useState<string | null>(null);

    // Fall back to the first file when the chosen one no longer exists (the model changed).
    const active = files.find((file) => file.id === activeId) ?? files[0];

    if (!active) {
        return <ConfigPreview filename={emptyFilename} content={null} state={state} classifyLine={classifyLine} />;
    }

    const several = files.length > 1;

    return (
        <ConfigPreview
            filename={active.filename}
            content={active.content}
            state={state}
            classifyLine={classifyLine}
            tabs={
                several ? (
                    <SegmentedControl
                        name="generated-file"
                        label="Generated file"
                        hideLabel
                        value={active.id}
                        options={files.map((file) => ({ value: file.id, label: file.label }))}
                        onChange={setActiveId}
                    />
                ) : undefined
            }
            extraActions={
                several ? (
                    <Button
                        size="sm"
                        icon={<Download className="h-3.5 w-3.5" />}
                        onClick={() => downloadTextFiles(files)}
                    >
                        Download all
                    </Button>
                ) : undefined
            }
        />
    );
});
