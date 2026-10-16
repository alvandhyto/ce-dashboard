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
import { Button } from "../../components/ui/Button";
import { Panel } from "../../components/ui/Panel";
import { SelectField } from "../../components/ui/SelectField";
import { Toast } from "../../components/ui/Toast";
import { ToggleCard } from "../../components/ui/ToggleCard";
import type { AppProps } from "../../app/types";
import { useConfigForm } from "../../hooks/useConfigForm";
import { useTemplate } from "../../hooks/useTemplate";
import { useToast } from "../../hooks/useToast";

import {
    DEFAULT_FIRMWARE,
    DEFAULT_SERIES,
    DEFAULT_UPLINKS,
    FIELDS,
    FIRMWARE_OPTIONS,
    INITIAL_VALUES,
    SERIES_OPTIONS,
    assignDhcp,
    assignInterface,
    outputFileName,
    templateFileName,
    templateUrl,
    type FirmwareVersion,
    type FortigateOptions,
    type Series,
    type UplinkRole,
    type Uplinks,
} from "./definition";
import { generateConfig } from "./generate";
import { classifyFortigateLine } from "./syntax";
import { UplinkSection } from "./UplinkSection";

export type { FirmwareVersion, Series } from "./definition";

interface GeneratedConfig {
    content: string;
    filename: string;
    /** Snapshot of the inputs used, to tell whether the output is still current. */
    signature: string;
}

export default function FortigateConfigurator({ onBack }: AppProps) {
    const [series, setSeries] = useState<Series>(DEFAULT_SERIES);
    const [firmware, setFirmware] = useState<FirmwareVersion>(DEFAULT_FIRMWARE);
    const [dualLink, setDualLink] = useState(false);
    const [sdWanChoice, setSdWanChoice] = useState(false);
    const [uplinks, setUplinks] = useState<Uplinks>(DEFAULT_UPLINKS);
    const [generated, setGenerated] = useState<GeneratedConfig | null>(null);

    // Dual link requires SD-WAN, so derive it instead of keeping two states in sync.
    const sdWan = dualLink || sdWanChoice;
    const options: FortigateOptions = { dualLink, sdWan, uplinks };

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

    const fieldsIn = (group: string) =>
        form.visibleFields.filter((field) => field.group === group);

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

    const changeInterface = (role: UplinkRole, next: string) =>
        setUplinks((current) => assignInterface(current, role, next));
    const changeDhcp = (role: UplinkRole, dhcp: boolean) =>
        setUplinks((current) => assignDhcp(current, role, dhcp));

    const handleGenerate = () => {
        if (!template) return;
        if (!form.validate()) return;

        try {
            const { content, warnings } = generateConfig(
                template,
                form.trimmedValues,
                options,
            );
            setGenerated({
                content,
                filename: outputFileName(form.trimmedValues.hostname),
                signature: currentSignature,
            });

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
        setDualLink(false);
        setSdWanChoice(false);
        setUplinks(DEFAULT_UPLINKS);
        setGenerated(null);
        dismissToast();
    };

    const sharedFieldProps = {
        values: form.values,
        errors: form.errors,
        onChange: form.setValue,
    };

    return (
        <>
            <ConfiguratorLayout
                header={
                    <AppHeader
                        title="FortiGate configuration generator"
                        subtitle="Internet use only"
                        icon={
                            <img
                                src="/icons/fortilogo.ico"
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
                                    Generate config
                                </Button>
                            }
                        >
                            <FormSection title="Device">
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
                                <FieldGrid
                                    fields={fieldsIn("device")}
                                    {...sharedFieldProps}
                                />
                            </FormSection>

                            <FormSection title="Link setup">
                                <div className="grid grid-cols-2 gap-3">
                                    <ToggleCard
                                        label="Dual link"
                                        description="Adds a secondary link"
                                        checked={dualLink}
                                        onChange={setDualLink}
                                    />
                                    <ToggleCard
                                        label="SD-WAN"
                                        description={
                                            dualLink
                                                ? "Required for dual link"
                                                : "Optional for single link"
                                        }
                                        checked={sdWan}
                                        disabled={dualLink}
                                        onChange={setSdWanChoice}
                                    />
                                </div>
                            </FormSection>

                            <UplinkSection
                                role="primary"
                                title="Main link"
                                uplink={uplinks.primary}
                                other={
                                    dualLink
                                        ? {
                                              label: "secondary link",
                                              uplink: uplinks.secondary,
                                          }
                                        : null
                                }
                                onInterfaceChange={(next) =>
                                    changeInterface("primary", next)
                                }
                                onDhcpChange={(dhcp) =>
                                    changeDhcp("primary", dhcp)
                                }
                                fields={fieldsIn("primary")}
                                {...sharedFieldProps}
                            />

                            {dualLink && (
                                <UplinkSection
                                    role="secondary"
                                    title="Secondary link"
                                    uplink={uplinks.secondary}
                                    other={{
                                        label: "main link",
                                        uplink: uplinks.primary,
                                    }}
                                    onInterfaceChange={(next) =>
                                        changeInterface("secondary", next)
                                    }
                                    onDhcpChange={(dhcp) =>
                                        changeDhcp("secondary", dhcp)
                                    }
                                    fields={fieldsIn("secondary")}
                                    {...sharedFieldProps}
                                />
                            )}

                            <FormSection title="LAN and loopback">
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
