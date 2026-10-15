import { Lock, ShieldAlert } from "lucide-react";
import { useState, type FormEvent } from "react";
import { AppShell } from "../components/layout/AppShell";
import { AppHeader } from "../components/layout/AppHeader";
import { Button } from "../components/ui/Button";
import { TextField } from "../components/ui/TextField";

interface AccessGatePageProps {
    /** Returns true when the key is accepted. */
    onSubmit: (key: string) => boolean;
    onCancel: () => void;
}

export function AccessGatePage({ onSubmit, onCancel }: AccessGatePageProps) {
    const [key, setKey] = useState("");
    const [failed, setFailed] = useState(false);

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const ok = onSubmit(key);
        setFailed(!ok);
        if (ok) setKey("");
    };

    return (
        <AppShell>
            <AppHeader title="Generators" subtitle="Restricted access" onBack={onCancel} />

            <main className="flex flex-1 items-center justify-center px-4 py-10">
                <form
                    noValidate
                    onSubmit={handleSubmit}
                    className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-[#151A22]"
                >
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                        {failed ? (
                            <ShieldAlert className="h-5 w-5 animate-shake motion-reduce:animate-none" />
                        ) : (
                            <Lock className="h-5 w-5" />
                        )}
                    </span>

                    <h2 className="mt-5 text-lg font-semibold text-slate-900 dark:text-slate-100">
                        Restricted access
                    </h2>
                    <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                        Generators produce sensitive configurations. Enter the access key to continue.
                    </p>

                    <TextField
                        id="access-key"
                        label="Access key"
                        type="password"
                        value={key}
                        onChange={(value) => {
                            setKey(value);
                            setFailed(false);
                        }}
                        error={failed ? "That key isn't valid. Check it and try again." : undefined}
                        autoFocus
                        className="mt-6"
                    />

                    <div className="mt-6 flex flex-col gap-2">
                        <Button type="submit" variant="primary" size="lg" disabled={key === ""}>
                            Continue
                        </Button>
                        <Button size="lg" variant="ghost" onClick={onCancel}>
                            Cancel
                        </Button>
                    </div>
                </form>
            </main>
        </AppShell>
    );
}
