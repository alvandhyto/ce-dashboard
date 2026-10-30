import type { ReactNode } from "react";

interface FormSectionProps {
    title: string;
    description?: string;
    children: ReactNode;
}

/**
 * One block of a long form. Put several inside a `divide-y` container (such as a
 * Panel body with bodyClassName="divide-y ...") and they separate themselves.
 */
export function FormSection({ title, description, children }: FormSectionProps) {
    return (
        <section className="space-y-4 p-5">
            <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
                {description ? (
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
                ) : null}
            </div>
            {children}
        </section>
    );
}
