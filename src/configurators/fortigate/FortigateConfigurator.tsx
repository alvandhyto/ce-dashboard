import { useMemo, useState, type FormEvent } from "react";
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
import { SelectField } from "../../components/ui/SelectField";
import { Toast } from "../../components/ui/Toast";
import { ToggleCard } from "../../components/ui/ToggleCard";
import type { AppProps } from "../../core/types";
import { useConfigForm } from "../../hooks/useConfigForm";
import { useTemplates } from "../../hooks/useTemplates";
import { useGenerator } from "../../hooks/useGenerator";

import {
    DEFAULT_FIRMWARE,
    DEFAULT_SERIES,
    FALLBACK_INTERFACES,
    FIELDS,
    FIRMWARE_OPTIONS,
    INITIAL_CHOICES,
    INITIAL_VALUES,
    SERIES_OPTIONS,
    assignDhcp,
    assignInterface,
    outputFileName,
    resolveUplinks,
    templateFileName,
    templateUrl,
    type FirmwareVersion,
    type FortigateOptions,
    type Series,
    type UplinkChoices,
    type UplinkRole,
} from "./definition";
import { generateConfig, inspectTemplate } from "./generate";
import { classifyFortiOSLine } from "../../lib/syntax";
import { UplinkSection } from "./UplinkSection";

interface GeneratedConfig {
    content: string;
    filename: string;
}

export default function FortigateConfigurator({ onBack }: AppProps) {
    const [series, setSeries] = useState<Series>(DEFAULT_SERIES);
    const [firmware, setFirmware] = useState<FirmwareVersion>(DEFAULT_FIRMWARE);
    const [dualLink, setDualLink] = useState(false);
    const [choices, setChoices] = useState<UplinkChoices>(INITIAL_CHOICES);

    const {
        status: templateStatus,
        template,
        error: templateError,
        retry,
    } = useTemplates([templateUrl(series, firmware)]);

    // Ports and default uplink positions come from the selected template, so
    // 30G and 40F each offer their own. Falls back to a fixed list until the
    // template is loaded, or when its ports can't be read.
    const layout = useMemo(
        () => (template ? inspectTemplate(template) : null),
        [template],
    );
    const ports =
        layout && layout.ports.length > 0 ? layout.ports : FALLBACK_INTERFACES;
    const uplinks = useMemo(
        () => resolveUplinks(choices, ports, layout?.defaults ?? {}),
        [choices, ports, layout],
    );

    const options: FortigateOptions = { dualLink, uplinks };
    const form = useConfigForm({
        initialValues: INITIAL_VALUES,
        fields: FIELDS,
        context: options,
    });
    const generator = useGenerator<GeneratedConfig>({
        series,
        firmware,
        options,
        values: form.trimmedValues,
    });

    // Picking a port pins both uplinks, so a later template switch can't move the other one.
    const changeInterface = (role: UplinkRole, next: string) =>
        setChoices(assignInterface(uplinks, role, next));
    const changeDhcp = (role: UplinkRole, dhcp: boolean) =>
        setChoices((current) => assignDhcp(current, role, dhcp));

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!template || !form.validate()) return;
        generator.run(() => {
            const { content, warnings } = generateConfig(template, form.trimmedValues, options);
            return {
                output: { content, filename: outputFileName(form.trimmedValues.hostname) },
                warnings,
            };
        });
    };

    const handleReset = () => {
        form.reset();
        setDualLink(false);
        setChoices(INITIAL_CHOICES);
        generator.clear();
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
                                    Generate Configuration
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
                                    fields={form.fieldsIn("device")}
                                    {...form.fieldProps}
                                />
                            </FormSection>

                            <FormSection title="Link Setup">
                                <div className="grid grid-cols-2 gap-3">
                                    <ToggleCard
                                        label="Dual Link"
                                        description="Adds a secondary link"
                                        checked={dualLink}
                                        onChange={setDualLink}
                                    />
                                </div>
                            </FormSection>

                            <UplinkSection
                                role="primary"
                                title="Primary Link"
                                uplink={uplinks.primary}
                                ports={ports}
                                other={
                                    dualLink
                                        ? {
                                              label: "Secondary Link",
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
                                fields={form.fieldsIn("primary")}
                                {...form.fieldProps}
                            />

                            {dualLink ? (
                                <UplinkSection
                                    role="secondary"
                                    title="Secondary Link"
                                    uplink={uplinks.secondary}
                                    ports={ports}
                                    other={{
                                        label: "Primary Link",
                                        uplink: uplinks.primary,
                                    }}
                                    onInterfaceChange={(next) =>
                                        changeInterface("secondary", next)
                                    }
                                    onDhcpChange={(dhcp) =>
                                        changeDhcp("secondary", dhcp)
                                    }
                                    fields={form.fieldsIn("secondary")}
                                    {...form.fieldProps}
                                />
                            ) : null}

                            <FormSection title="LAN and Loopback">
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
                        filename={generator.output?.filename ?? outputFileName("")}
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
