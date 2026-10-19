import type { LineKind } from "../components/configurator/ConfigPreview";

/** FortiOS CLI: config/edit open blocks, set/unset assign, end/next close them, # is a comment. */
export function fortigateSyntax(line: string): LineKind {
    const text = line.trim();

    if (text === "") return "plain";
    if (text.startsWith("#")) return "comment";
    if (/^(config|edit)\b/.test(text)) return "keyword";
    if (/^(set|unset|append|unappend|select|unselect)\b/.test(text))
        return "setting";
    if (/^(end|next)$/.test(text)) return "end";
    return "plain";
}
