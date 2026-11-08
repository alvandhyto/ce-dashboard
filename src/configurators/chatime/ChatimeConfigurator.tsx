import { useState } from "react";

import { ConfigPreview } from "../../components/configurator/ConfigPreview";
import { ConfiguratorLayout } from "../../components/configurator/ConfiguratorLayout";
import { FieldGrid } from "../../components/configurator/FieldGrid";
import { FormSection } from "../../components/configurator/FormSection";
import { TemplateStatus } from "../../components/configurator/TemplateStatus";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import type { AppProps } from "../../core/types";
import { useConfigForm } from "../../hooks/useConfigForm";
import { useGenerator } from "../../hooks/useGenerator";
import { useTemplates } from "../../hooks/useTemplates";
import { classifyFortiOSLine } from "../../lib/syntax";

import {
    DEFAULT_SERIES,
    FALLBACK_FILENAME,
    FIELDS,
    INITIAL_VALUES,
    SERIES_OPTIONS,
    outputFileName,
    templateFileName,
    templateUrl,
    type Series,
} from "./definition";
import { generateChatimeConfig } from "./generate";

interface GeneratedConfig {
    content: string;
    filename: string;
}

export default function ChatimeConfigurator({ onBack }: AppProps) {
    const [series, setSeries] = useState<Series>(DEFAULT_SERIES);

    const form = useConfigForm({ initialValues: INITIAL_VALUES, fields: FIELDS, context: { series } });
    const { status: templateStatus, template, error: templateError, retry } = useTemplates([templateUrl(series)]);
    const generator = useGenerator<GeneratedConfig>({ series, values: form.trimmedValues });

    const handleGenerate = () => {
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
        <ConfiguratorLayout
            title="Chatime FortiGate Configurator"
            subtitle="Project Replace Versa"
            logo="/icons/chatimelogo.png"
            onBack={onBack}
            onReset={handleReset}
            dirty={form.dirty}
            onGenerate={handleGenerate}
            ready={templateStatus === "ready"}
            accent="violet"
            toast={generator.toast}
            onDismissToast={generator.dismissToast}
            preview={
                <ConfigPreview
                    filename={generator.output?.filename ?? outputFileName("", FALLBACK_FILENAME)}
                    content={generator.output?.content ?? null}
                    state={generator.state}
                    classifyLine={classifyFortiOSLine}
                />
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
                <FieldGrid fields={form.fieldsIn("device")} {...form.fieldProps} />
            </FormSection>

            <FormSection title="AirFiber Link">
                <FieldGrid fields={form.fieldsIn("airfiber")} {...form.fieldProps} />
            </FormSection>

            <FormSection title="M2M Link">
                <FieldGrid fields={form.fieldsIn("m2m")} {...form.fieldProps} />
            </FormSection>

            <FormSection title="PTP, LAN and Loopback">
                <FieldGrid fields={form.fieldsIn("network")} {...form.fieldProps} />
            </FormSection>
        </ConfiguratorLayout>
    );
}
