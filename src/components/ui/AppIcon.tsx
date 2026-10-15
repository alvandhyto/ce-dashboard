import type { ReactNode } from "react";
import { ACCENTS, type Accent } from "../../lib/accent";
import { cn } from "../../lib/cn";

interface AppIconProps {
    accent: Accent;
    children: ReactNode;
    size?: "sm" | "md";
}

/** Rounded tile in the app's accent colour, holding an icon. */
export function AppIcon({ accent, children, size = "md" }: AppIconProps) {
    return (
        <span
            className={cn(
                "inline-flex shrink-0 items-center justify-center rounded-lg",
                size === "md" ? "h-11 w-11" : "h-9 w-9",
                ACCENTS[accent].tile,
            )}
        >
            {children}
        </span>
    );
}
