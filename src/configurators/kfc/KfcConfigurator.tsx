import { useState, type FormEvent } from "react";
import { RotateCcw, Terminal } from "lucide-react";

import { ConfiguratorLayout } from "../../components/configurator/ConfiguratorLayout";
import { FieldGrid } from "../../components/configurator/FieldGrid";
import { FormSection } from "../../components/configurator/FormSection";
import {
    MultiConfigPreview,
    type GeneratedFile,
} from "../../components/configurator/MultiConfigPreview";
import type { PreviewState } from "../../components/configurator/ConfigPreview";
import { TemplateStatus } from "../../components/configurator/TemplateStatus";
import { AppHeader } from "../../components/layout/AppHeader";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Toast } from "../../components/ui/Toast";
import type { AppProps } from "../../core/types";
import { useConfigForm } from "../../hooks/useConfigForm";
import { useTemplates } from "../../hooks/useTemplates";
import { useToast } from "../../hooks/useToast";
import { classifyFortiOSLine } from "../../lib/syntax";

import {
    DEFAULT_SERIES,
    FIELDS,
    INITIAL_VALUES,
    SERIES_OPTIONS,
    hasBroadband,
    hasSwitch,
    templateFileNames,
    templateUrls,
    type KfcOptions,
    type Series,
} from "./definition";
import { generateKfcConfigs } from "./generate";

export type { Series } from "./definition";

interface GeneratedState {
    files: GeneratedFile[];
    /** Snapshot of the inputs used, to tell whether the output is still current. */
    signature: string;
}

/** A module-level constant, so the memoised preview isn't re-rendered for nothing. */
const NO_FILES: GeneratedFile[] = [];

export default function KfcConfigurator({ onBack }: AppProps) {
    const [series, setSeries] = useState<Series>(DEFAULT_SERIES);
    const [generated, setGenerated] = useState<GeneratedState | null>(null);

    const options: KfcOptions = { series };
    const form = useConfigForm({
        initialValues: INITIAL_VALUES,
        fields: FIELDS,
        context: options,
    });
    const {
        status: templateStatus,
        templates,
        error: templateError,
        retry,
    } = useTemplates(templateUrls(series));
    const { toast, show: showToast, dismiss: dismissToast } = useToast();

    const fieldsIn = (group: string) =>
        form.visibleFields.filter((field) => field.group === group);
    const sharedFieldProps = {
        values: form.values,
        errors: form.errors,
        onChange: form.setValue,
    };

    const currentSignature = JSON.stringify({
        series,
        values: form.trimmedValues,
    });
    const previewState: PreviewState = !generated
        ? "empty"
        : generated.signature === currentSignature
          ? "current"
          : "outdated";

    const handleGenerate = () => {
        if (!templates) return;
        if (!form.validate()) return;

        try {
            const { files, warnings } = generateKfcConfigs(
                templates,
                form.trimmedValues,
                series,
            );
            setGenerated({ files, signature: currentSignature });

            if (warnings.length > 0) {
                showToast(
                    "warning",
                    ["Generated, but check:", ...warnings].join("\n"),
                );
            } else {
                showToast(
                    "success",
                    files.length > 1
                        ? `${files.length} configurations generated.`
                        : "Configuration generated.",
                );
            }
        } catch (error) {
            showToast(
                "error",
                error instanceof Error
                    ? error.message
                    : "The configuration could not be generated.",
            );
        }
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        handleGenerate();
    };

    const handleReset = () => {
        form.reset();
        setGenerated(null);
        dismissToast();
    };

    return (
        <>
            <ConfiguratorLayout
                header={
                    <AppHeader
                        title="KFC FortiGate configurator"
                        subtitle="Project Replace Fortigate 50E"
                        icon={
                            <img
                                src="/icons/kfclogo.png"
                                alt=""
                                className="h-8 w-8 shrink-0"
                            />
                        }
                        onBack={onBack}
                        width="wide"
                        actions={
                            <Button
                                icon={<RotateCcw className="h-4 w-4" />}
                                onClick={handleReset}
                            >
                                Reset
                            </Button>
                        }
                    />
                }
                sidebar={
                    <form
                        noValidate
                        onSubmit={handleSubmit}
                        className="flex min-h-0 flex-1 flex-col"
                    >
                        <Panel
                            title="Parameters"
                            bodyClassName="divide-y divide-slate-200 dark:divide-white/10"
                            footer={
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    className="w-full"
                                    icon={<Terminal className="h-4 w-4" />}
                                    disabled={templateStatus !== "ready"}
                                >
                                    {hasSwitch(series)
                                        ? "Generate configs"
                                        : "Generate config"}
                                </Button>
                            }
                        >
                            <FormSection title="Device">
                                <SegmentedControl
                                    name="kfc-series"
                                    label="Model"
                                    value={series}
                                    options={SERIES_OPTIONS}
                                    onChange={setSeries}
                                />
                                <TemplateStatus
                                    status={templateStatus}
                                    name={templateFileNames(series).join(" + ")}
                                    error={templateError}
                                    onRetry={retry}
                                />
                                <FieldGrid
                                    fields={fieldsIn("device")}
                                    {...sharedFieldProps}
                                />
                            </FormSection>

                            <FormSection title="Internet link">
                                <FieldGrid
                                    fields={fieldsIn("link")}
                                    {...sharedFieldProps}
                                />
                                {!hasBroadband(series) && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        The 30G template has no broadband link.
                                    </p>
                                )}
                            </FormSection>

                            <FormSection title="LAN and loopbacks">
                                <FieldGrid
                                    fields={fieldsIn("network")}
                                    {...sharedFieldProps}
                                />
                            </FormSection>
                        </Panel>
                    </form>
                }
                main={
                    <MultiConfigPreview
                        files={generated?.files ?? NO_FILES}
                        emptyFilename="kfc.conf"
                        state={previewState}
                        classifyLine={classifyFortiOSLine}
                    />
                }
            />
            <Toast toast={toast} onDismiss={dismissToast} />
        </>
    );
}
