/**
 * Copies text to the clipboard.
 *
 * navigator.clipboard only exists in secure contexts (https / localhost). Internal
 * tools are often served over plain http, so fall back to a hidden textarea.
 */
export async function copyText(text: string): Promise<boolean> {
    try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        }
    } catch {
        // fall through to the legacy path
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
        return document.execCommand("copy");
    } catch {
        return false;
    } finally {
        document.body.removeChild(textarea);
    }
}
