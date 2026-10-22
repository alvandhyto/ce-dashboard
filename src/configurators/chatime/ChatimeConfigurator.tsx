import { useState, type FormEvent } from "react";
import { RotateCcw, Terminal } from "lucide-react";

import {
    ConfigPreview,
    type PreviewState,
} from "../../components/configurator/ConfigPreview";
import { ConfiguratorLayout } from "../../components/configurator/ConfiguratorLayout";
import { FieldGrid } from "../../components/configurator/FieldGrid";
import { FormSection } from "../../components/configurator/FormSection";
import { TemplateStatus } from "../../components/configurator/TemplateStatus";
import { AppHeader } from "../../components/layout/AppHeader";
import { Button, IconButton } from "../../components/ui/Button";
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
    outputFileName,
    templateFileName,
    templateUrl,
    type ChatimeOptions,
    type Series,
} from "./definition";
import { generateChatimeConfig } from "./generate";

export type { Series } from "./definition";

interface GeneratedConfig {
    content: string;
    filename: string;
    /** Snapshot of the inputs used, to tell whether the output is still current. */
    signature: string;
}

export default function ChatimeConfigurator({ onBack }: AppProps) {
    const [series, setSeries] = useState<Series>(DEFAULT_SERIES);
    const [generated, setGenerated] = useState<GeneratedConfig | null>(null);

    const options: ChatimeOptions = { series };
    const form = useConfigForm({
        initialValues: INITIAL_VALUES,
        fields: FIELDS,
        context: options,
    });
    const {
        status: templateStatus,
        template,
        error: templateError,
        retry,
    } = useTemplates([templateUrl(series)]);
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
        if (!template) return;
        if (!form.validate()) return;

        try {
            const { content, filename, warnings } = generateChatimeConfig(
                template,
                form.trimmedValues,
            );
            setGenerated({ content, filename, signature: currentSignature });

            if (warnings.length > 0) {
                showToast(
                    "warning",
                    ["Generated, but check:", ...warnings].join("\n"),
                );
            } else {
                showToast("success", "Configuration generated.");
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
                        title="Chatime FortiGate configurator"
                        subtitle="Project Replace Versa"
                        icon={
                            <img
                                src="/icons/chatimelogo.png"
                                alt=""
                                className="h-8 w-8 shrink-0"
                            />
                        }
                        onBack={onBack}
                        width="wide"
                        actions={
                            <IconButton label="Reset" onClick={handleReset}>
                                <RotateCcw className="h-4 w-4" />
                            </IconButton>
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
                                    accent="violet"
                                    size="lg"
                                    className="w-full uppercase"
                                    icon={<Terminal className="h-4 w-4" />}
                                    disabled={templateStatus !== "ready"}
                                >
                                    Generate Configuration
                                </Button>
                            }
                        >
                            <FormSection title="Device">
                                <SegmentedControl
                                    id="chatime-series"
                                    label="Model"
                                    value={series}
                                    options={SERIES_OPTIONS}
                                    onChange={setSeries}
                                />
                                <TemplateStatus
                                    status={templateStatus}
                                    name={templateFileName(series)}
                                    error={templateError}
                                    onRetry={retry}
                                />
                                <FieldGrid
                                    fields={fieldsIn("device")}
                                    {...sharedFieldProps}
                                />
                            </FormSection>

                            <FormSection title="AirFiber Link">
                                <FieldGrid
                                    fields={fieldsIn("airfiber")}
                                    {...sharedFieldProps}
                                />
                            </FormSection>

                            <FormSection title="M2M Link">
                                <FieldGrid
                                    fields={fieldsIn("m2m")}
                                    {...sharedFieldProps}
                                />
                            </FormSection>

                            <FormSection title="PTP, LAN and Loopback">
                                <FieldGrid
                                    fields={fieldsIn("network")}
                                    {...sharedFieldProps}
                                />
                            </FormSection>
                        </Panel>
                    </form>
                }
                main={
                    <ConfigPreview
                        filename={
                            generated?.filename ??
                            outputFileName("", "fortigate_chatime")
                        }
                        content={generated?.content ?? null}
                        state={previewState}
                        classifyLine={classifyFortiOSLine}
                    />
                }
            />
            <Toast toast={toast} onDismiss={dismissToast} />
        </>
    );
}
