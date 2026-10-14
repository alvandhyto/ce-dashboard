import { useState, type FormEvent } from "react";
import { Terminal } from "lucide-react";

import {
    ConfigPreview,
    type PreviewState,
} from "../../components/configurator/ConfigPreview";
import { ConfiguratorHeader } from "../../components/configurator/ConfiguratorHeader";
import { ConfiguratorLayout } from "../../components/configurator/ConfiguratorLayout";
import { FieldGrid } from "../../components/configurator/FieldGrid";
import { TemplateStatus } from "../../components/configurator/TemplateStatus";
import type { ConfiguratorProps } from "../../components/configurator/types";
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { SelectField } from "../../components/ui/SelectField";
import { Toast } from "../../components/ui/Toast";
import { ToggleCard } from "../../components/ui/ToggleCard";
import { useConfigForm } from "../../hooks/useConfigForm";
import { useTemplate } from "../../hooks/useTemplate";
import { useToast } from "../../hooks/useToast";
import { findUnresolvedPlaceholders, renderTemplate } from "../../lib/template";

import {
    DEFAULT_FIRMWARE,
    DEFAULT_SERIES,
    FIELDS,
    FIRMWARE_OPTIONS,
    INITIAL_VALUES,
    SERIES_OPTIONS,
    buildReplacements,
    outputFileName,
    templateFileName,
    templateUrl,
    type FirmwareVersion,
    type FortigateOptions,
    type Series,
} from "./definition";
import { classifyFortigateLine } from "./syntax";

export type { FirmwareVersion, Series } from "./definition";

interface GeneratedConfig {
    content: string;
    filename: string;
    /** Snapshot of the inputs used, to tell whether the output is still current. */
    signature: string;
}

export default function FortigateConfigurator({
    onBack,
    isDarkMode,
    toggleTheme,
}: ConfiguratorProps) {
    const [series, setSeries] = useState<Series>(DEFAULT_SERIES);
    const [firmware, setFirmware] = useState<FirmwareVersion>(DEFAULT_FIRMWARE);
    const [dualLink, setDualLink] = useState(false);
    const [bgp, setBGP] = useState(false);
    const [generated, setGenerated] = useState<GeneratedConfig | null>(null);

    const options: FortigateOptions = { dualLink, bgp };

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
    } = useTemplate(templateUrl(series, firmware));
    const { toast, show: showToast, dismiss: dismissToast } = useToast();

    const currentSignature = JSON.stringify({
        series,
        firmware,
        options,
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

        const content = renderTemplate(
            template,
            buildReplacements(form.trimmedValues, options),
        );
        setGenerated({
            content,
            filename: outputFileName(form.trimmedValues.hostname),
            signature: currentSignature,
        });

        const unresolved = findUnresolvedPlaceholders(content);
        if (unresolved.length > 0) {
            showToast(
                "warning",
                `Generated, but the template still contains unfilled placeholders: ${unresolved.join(", ")}`,
            );
        } else {
            showToast("success", "Configuration generated.");
        }
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        handleGenerate();
    };

    const handleReset = () => {
        form.reset();
        setDualLink(false);
        setBGP(false);
        setGenerated(null);
        dismissToast();
    };

    return (
        <>
            <ConfiguratorLayout
                header={
                    <ConfiguratorHeader
                        title="FortiGate Configuration Generator"
                        subtitle="Internet access only"
                        logoSrc="/icons/fortilogo.ico"
                        logoAlt="FortiGate"
                        onBack={onBack}
                        onReset={handleReset}
                        isDarkMode={isDarkMode}
                        onToggleTheme={toggleTheme}
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
                            bodyClassName="space-y-6 p-5"
                            footer={
                                <Button
                                    type="submit"
                                    variant="primary"
                                    size="lg"
                                    className="w-full"
                                    icon={<Terminal className="h-4 w-4" />}
                                    disabled={templateStatus !== "ready"}
                                >
                                    Generate Configuration
                                </Button>
                            }
                        >
                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-4">
                                    <SelectField
                                        id="select-series"
                                        label="Model"
                                        value={series}
                                        options={SERIES_OPTIONS}
                                        onChange={setSeries}
                                    />
                                    <SelectField
                                        id="select-firmware"
                                        label="Firmware"
                                        value={firmware}
                                        options={FIRMWARE_OPTIONS}
                                        onChange={setFirmware}
                                    />
                                </div>
                                <TemplateStatus
                                    status={templateStatus}
                                    name={templateFileName(series, firmware)}
                                    error={templateError}
                                    onRetry={retry}
                                />
                            </div>

                            <fieldset>
                                <legend className="mb-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                                    Link setup
                                </legend>
                                <div className="grid grid-cols-2 gap-3">
                                    <ToggleCard
                                        label="Dual Link"
                                        description="Adds a secondary broadband link"
                                        checked={dualLink}
                                        onChange={setDualLink}
                                    />
                                    <ToggleCard
                                        label="BGP"
                                        description="Adds BGP configuration"
                                        checked={bgp}
                                        onChange={setBGP}
                                    />
                                </div>
                            </fieldset>

                            <FieldGrid
                                fields={form.visibleFields}
                                values={form.values}
                                errors={form.errors}
                                onChange={form.setValue}
                            />
                        </Panel>
                    </form>
                }
                main={
                    <ConfigPreview
                        filename={generated?.filename ?? outputFileName("")}
                        content={generated?.content ?? null}
                        state={previewState}
                        classifyLine={classifyFortigateLine}
                    />
                }
            />
            <Toast toast={toast} onDismiss={dismissToast} />
        </>
    );
}
