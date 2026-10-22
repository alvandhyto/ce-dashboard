import { cn } from "../../lib/cn";
import { containerClass, type ContainerWidth } from "./container";

export function PageFooter({
    children,
    width = "wide",
}: {
    children: string;
    width?: ContainerWidth;
}) {
    return (
        <footer className={cn(containerClass(width), "py-6")}>
            <p className="font-mono text-xs text-slate-500 uppercase tracking-tighter">
                {children}
            </p>
        </footer>
    );
}
