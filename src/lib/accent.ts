/**
 * Per-app accent colours.
 *
 * Tailwind only generates classes it can find as complete strings in the source,
 * so every class is written out in full here instead of being built from a name.
 */
export type Accent = "blue" | "rose" | "amber";

interface AccentStyles {
    /** Solid fill for primary buttons. */
    solid: string;
    /** Soft tile behind an icon. */
    tile: string;
    /** Icon or text colour. */
    text: string;
    /** SVG stroke. */
    stroke: string;
    /** Surface of a highlighted ("active") card. */
    activeCard: string;
}

export const ACCENTS: Record<Accent, AccentStyles> = {
    blue: {
        solid: "bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500/50",
        tile: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
        text: "text-blue-600 dark:text-blue-400",
        stroke: "stroke-blue-500",
        activeCard:
            "border-blue-300 bg-blue-50/60 dark:border-blue-500/40 dark:bg-blue-500/10",
    },
    rose: {
        solid: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-500/50",
        tile: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400",
        text: "text-rose-600 dark:text-rose-400",
        stroke: "stroke-rose-500",
        activeCard:
            "border-rose-300 bg-rose-50/60 dark:border-rose-500/40 dark:bg-rose-500/10",
    },
    // amber-700 rather than 600 for the solid fill: white on amber-600 fails WCAG AA.
    amber: {
        solid: "bg-amber-700 text-white hover:bg-amber-800 focus-visible:ring-amber-500/50",
        tile: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
        text: "text-amber-700 dark:text-amber-400",
        stroke: "stroke-amber-500",
        activeCard:
            "border-amber-300 bg-amber-50/60 dark:border-amber-500/40 dark:bg-amber-500/10",
    },
};
