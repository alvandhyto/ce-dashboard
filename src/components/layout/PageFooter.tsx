import { cn } from "../../lib/cn";
import { containerClass, type ContainerWidth } from "./container";

export function PageFooter({
    children,
    width = "default",
}: {
    children: string;
    width?: ContainerWidth;
}) {
    return (
        <footer className={cn(containerClass(width), "py-6")}>
            <p className="font-mono text-xs text-slate-500">{children}</p>
        </footer>
    );
}
