/** Triggers a browser download for a text payload. */
export function downloadTextFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

export interface TextFile {
    filename: string;
    content: string;
}

/**
 * Downloads several files one after another. Browsers drop downloads that
 * start in the same instant, so each one waits a moment. The browser may ask
 * once whether this site may download multiple files.
 */
export async function downloadTextFiles(files: readonly TextFile[], delayMs = 600): Promise<void> {
    for (const [index, file] of files.entries()) {
        if (index > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));
        downloadTextFile(file.content, file.filename);
    }
}
