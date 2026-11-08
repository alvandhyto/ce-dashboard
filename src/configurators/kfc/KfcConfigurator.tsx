import { useState } from "react";

import { ConfiguratorLayout } from "../../components/configurator/ConfiguratorLayout";
import { FieldGrid } from "../../components/configurator/FieldGrid";
import { FormSection } from "../../components/configurator/FormSection";
import { MultiConfigPreview, type GeneratedFile } from "../../components/configurator/MultiConfigPreview";
import { TemplateStatus } from "../../components/configurator/TemplateStatus";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import type { AppProps } from "../../core/types";
import { useConfigForm } from "../../hooks/useConfigForm";
import { useGenerator } from "../../hooks/useGenerator";
import { useTemplates } from "../../hooks/useTemplates";
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
    type Series,
} from "./definition";
import { generateKfcConfigs } from "./generate";

/** A module-level constant, so the memoised preview isn't re-rendered for nothing. */
const NO_FILES: GeneratedFile[] = [];

export default function KfcConfigurator({ onBack }: AppProps) {
    const [series, setSeries] = useState<Series>(DEFAULT_SERIES);

    const form = useConfigForm({ initialValues: INITIAL_VALUES, fields: FIELDS, context: { series } });
    const { status: templateStatus, templates, error: templateError, retry } = useTemplates(templateUrls(series));
    const generator = useGenerator<GeneratedFile[]>({ series, values: form.trimmedValues });

    const handleGenerate = () => {
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
        <ConfiguratorLayout
            title="KFC FortiGate Configurator"
            subtitle="Project Replace Fortigate 50E"
            logo="/icons/kfclogo.png"
            onBack={onBack}
            onReset={handleReset}
            dirty={form.dirty}
            onGenerate={handleGenerate}
            generateLabel={hasSwitch(series) ? "Generate Configurations" : "Generate Configuration"}
            ready={templateStatus === "ready"}
            toast={generator.toast}
            onDismissToast={generator.dismissToast}
            preview={
                <MultiConfigPreview
                    files={generator.output ?? NO_FILES}
                    emptyFilename="kfc.conf"
                    state={generator.state}
                    classifyLine={classifyFortiOSLine}
                />
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
                <FieldGrid fields={form.fieldsIn("device")} {...form.fieldProps} />
            </FormSection>

            <FormSection title="WAN Links">
                <FieldGrid fields={form.fieldsIn("link")} {...form.fieldProps} />
                {hasBroadband(series) ? null : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">The 30G template has no broadband link.</p>
                )}
            </FormSection>

            <FormSection title="LAN and Loopback">
                <FieldGrid fields={form.fieldsIn("network")} {...form.fieldProps} />
            </FormSection>
        </ConfiguratorLayout>
    );
}
