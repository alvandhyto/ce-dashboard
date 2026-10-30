import { useState, type FormEvent } from "react";
import { Terminal } from "lucide-react";

import { ConfigPreview } from "../../components/configurator/ConfigPreview";
import { ConfiguratorLayout } from "../../components/configurator/ConfiguratorLayout";
import { FieldGrid } from "../../components/configurator/FieldGrid";
import { FormSection } from "../../components/configurator/FormSection";
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
    outputFileName,
    templateFileName,
    templateUrl,
    type ChatimeOptions,
    type Series,
} from "./definition";
import { generateChatimeConfig } from "./generate";

interface GeneratedConfig {
    content: string;
    filename: string;
}

export default function ChatimeConfigurator({ onBack }: AppProps) {
    const [series, setSeries] = useState<Series>(DEFAULT_SERIES);

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
    const generator = useGenerator<GeneratedConfig>({ series, values: form.trimmedValues });

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!template || !form.validate()) return;
        generator.run(() => {
            const { content, filename, warnings } = generateChatimeConfig(template, form.trimmedValues);
            return { output: { content, filename }, warnings };
        });
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
                                    name="chatime-series"
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
                                    fields={form.fieldsIn("device")}
                                    {...form.fieldProps}
                                />
                            </FormSection>

                            <FormSection title="AirFiber Link">
                                <FieldGrid
                                    fields={form.fieldsIn("airfiber")}
                                    {...form.fieldProps}
                                />
                            </FormSection>

                            <FormSection title="M2M Link">
                                <FieldGrid
                                    fields={form.fieldsIn("m2m")}
                                    {...form.fieldProps}
                                />
                            </FormSection>

                            <FormSection title="PTP, LAN and Loopback">
                                <FieldGrid
                                    fields={form.fieldsIn("network")}
                                    {...form.fieldProps}
                                />
                            </FormSection>
                        </Panel>
                    </form>
                }
                main={
                    <ConfigPreview
                        filename={
                            generator.output?.filename ??
                            outputFileName("", "fortigate_chatime")
                        }
                        content={generator.output?.content ?? null}
                        state={generator.state}
                        classifyLine={classifyFortiOSLine}
                    />
                }
            />
            <Toast toast={generator.toast} onDismiss={generator.dismissToast} />
        </>
    );
}
