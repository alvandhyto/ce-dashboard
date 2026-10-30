import type { Accent } from "../../lib/accent";
import type { Direction } from "./model";

interface SeriesStyle {
    label: string;
    /** The tile highlight while this test runs. */
    accent: Accent;
    /** Gauge arc and graph line. */
    stroke: string;
    /** Graph area and dots. */
    fill: string;
    /** Legend key. */
    swatch: string;
}

/**
 * One colour per test, the same on the tile, the gauge and the graph. Blue and teal stay apart
 * under colour-vision deficiency and pass 3:1 against both surfaces (white and #151A22); blue
 * and violet, the obvious pair, collapse into one colour for deuteranopes.
 */
export const SERIES: Record<Direction, SeriesStyle> = {
    download: {
        label: "Download",
        accent: "blue",
        stroke: "stroke-blue-600 dark:stroke-blue-500",
        fill: "fill-blue-600 dark:fill-blue-500",
        swatch: "bg-blue-600 dark:bg-blue-500",
    },
    upload: {
        label: "Upload",
        accent: "teal",
        stroke: "stroke-teal-600",
        fill: "fill-teal-600",
        swatch: "bg-teal-600",
    },
};
