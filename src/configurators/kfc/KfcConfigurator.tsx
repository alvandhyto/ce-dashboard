import { useState, type FormEvent } from "react";
import { Terminal } from "lucide-react";

import { ConfiguratorLayout } from "../../components/configurator/ConfiguratorLayout";
import { FieldGrid } from "../../components/configurator/FieldGrid";
import { FormSection } from "../../components/configurator/FormSection";
import {
    MultiConfigPreview,
    type GeneratedFile,
} from "../../components/configurator/MultiConfigPreview";
import { ResetButton } from "../../components/configurator/ResetButton";
import { TemplateStatus } from "../../components/configurator/TemplateStatus";
import { AppHeader } from "../../components/layout/AppHeader";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { Toast } from "../../components/ui/Toast";
import type { AppProps } from "../../core/types";
import { useConfigForm } from "../../hooks/useConfigForm";
import { useTemplates } from "../../hooks/useTemplates";
import { useGenerator } from "../../hooks/useGenerator";
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

/** A module-level constant, so the memoised preview isn't re-rendered for nothing. */
const NO_FILES: GeneratedFile[] = [];

export default function KfcConfigurator({ onBack }: AppProps) {
    const [series, setSeries] = useState<Series>(DEFAULT_SERIES);

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
    const generator = useGenerator<GeneratedFile[]>({ series, values: form.trimmedValues });

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!templates || !form.validate()) return;
        generator.run(
            () => {
                const { files, warnings } = generateKfcConfigs(templates, form.trimmedValues, series);
                return { output: files, warnings };
            },
            (files) => (files.length > 1 ? `${files.length} configurations generated.` : "Configuration generated."),
        );
    };

    const handleReset = () => {
        form.reset();
        generator.clear();
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
                            <ResetButton onReset={handleReset} />
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
                                    className="w-full uppercase"
                                    icon={<Terminal className="h-4 w-4" />}
                                    disabled={templateStatus !== "ready"}
                                >
                                    {hasSwitch(series)
                                        ? "Generate Configurations"
                                        : "Generate Configuration"}
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
                                    fields={form.fieldsIn("device")}
                                    {...form.fieldProps}
                                />
                            </FormSection>

                            <FormSection title="WAN Links">
                                <FieldGrid
                                    fields={form.fieldsIn("link")}
                                    {...form.fieldProps}
                                />
                                {hasBroadband(series) ? null : (
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        The 30G template has no broadband link.
                                    </p>
                                )}
                            </FormSection>

                            <FormSection title="LAN and Loopback Links">
                                <FieldGrid
                                    fields={form.fieldsIn("network")}
                                    {...form.fieldProps}
                                />
                            </FormSection>
                        </Panel>
                    </form>
                }
                main={
                    <MultiConfigPreview
                        files={generator.output ?? NO_FILES}
                        emptyFilename="kfc.conf"
                        state={generator.state}
                        classifyLine={classifyFortiOSLine}
                    />
                }
            />
            <Toast toast={generator.toast} onDismiss={generator.dismissToast} />
        </>
    );
}
