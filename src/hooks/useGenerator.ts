import { useCallback, useState } from "react";
import type { PreviewState } from "../components/configurator/ConfigPreview";
import { useToast } from "./useToast";

interface Generated<Output> {
    output: Output;
    /** The inputs it came from, to tell whether the preview still matches the form. */
    signature: string;
}

/** What a generator returns: something to preview, and anything worth a second look. */
export interface GeneratorResult<Output> {
    output: Output;
    warnings: string[];
}

/**
 * The generate-and-preview cycle every configurator shares. `inputs` is everything the
 * output depends on (model, options, field values): when it changes after generating,
 * the preview is marked outdated.
 */
export function useGenerator<Output>(inputs: unknown) {
    const signature = JSON.stringify(inputs);
    const [generated, setGenerated] = useState<Generated<Output> | null>(null);
    const { toast, show, dismiss } = useToast();

    const state: PreviewState = !generated
        ? "empty"
        : generated.signature === signature
          ? "current"
          : "outdated";

    /**
     * Runs the generator. Its output becomes the preview; its warnings, or the message of
     * the error it throws, become the toast. `success` may depend on the output.
     */
    const run = (
        produce: () => GeneratorResult<Output>,
        success: string | ((output: Output) => string) = "Configuration generated.",
    ) => {
        try {
            const { output, warnings } = produce();
            setGenerated({ output, signature });
            if (warnings.length > 0) {
                show("warning", ["Generated, but check:", ...warnings].join("\n"));
            } else {
                show("success", typeof success === "function" ? success(output) : success);
            }
        } catch (error) {
            show("error", error instanceof Error ? error.message : "The configuration could not be generated.");
        }
    };

    const clear = useCallback(() => {
        setGenerated(null);
        dismiss();
    }, [dismiss]);

    return { output: generated?.output ?? null, state, run, clear, toast, dismissToast: dismiss };
}
