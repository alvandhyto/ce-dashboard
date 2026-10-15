import { cn } from "../../lib/cn";

export type ContainerWidth = "narrow" | "default" | "wide";

const WIDTHS: Record<ContainerWidth, string> = {
    narrow: "max-w-3xl",
    default: "max-w-5xl",
    wide: "max-w-7xl",
};

/** Centred, width-limited column. Header and page content share it so their edges line up. */
export const containerClass = (width: ContainerWidth = "default") =>
    cn("mx-auto w-full px-4 sm:px-6", WIDTHS[width]);
