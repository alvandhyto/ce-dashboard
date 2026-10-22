/** How a line is coloured in the preview. Each language supplies its own classifier. */
export type LineKind = "keyword" | "setting" | "end" | "comment" | "plain";

/**
 * FortiOS CLI, used by every FortiGate and FortiSwitch configurator:
 * config/edit open blocks, set/unset assign, end/next close them, # is a comment.
 */
export function classifyFortiOSLine(line: string): LineKind {
    const text = line.trim();

    if (text === "") return "plain";
    if (text.startsWith("#")) return "comment";
    if (/^(config|edit)\b/.test(text)) return "keyword";
    if (/^(set|unset|append|unappend|select|unselect)\b/.test(text))
        return "setting";
    if (/^(end|next)$/.test(text)) return "end";
    return "plain";
}
