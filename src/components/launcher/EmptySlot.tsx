import { Plus } from "lucide-react";

/** Dashed tile that marks where the next app will go. */
export function EmptySlot({ label }: { label: string }) {
    return (
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 p-6 text-center dark:border-white/15">
            <Plus className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            <p className="text-sm text-slate-500 dark:text-slate-400">{label}</p>
        </div>
    );
}
