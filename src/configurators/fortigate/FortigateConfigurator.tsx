import { useMemo, useState } from "react";

import { ConfigPreview } from "../../components/configurator/ConfigPreview";
import { ConfiguratorLayout } from "../../components/configurator/ConfiguratorLayout";
import { FieldGrid } from "../../components/configurator/FieldGrid";
import { FormSection } from "../../components/configurator/FormSection";
import { TemplateStatus } from "../../components/configurator/TemplateStatus";
import { SelectField } from "../../components/ui/SelectField";
import { ToggleCard } from "../../components/ui/ToggleCard";
import type { AppProps } from "../../core/types";
import { useConfigForm } from "../../hooks/useConfigForm";
import { useGenerator } from "../../hooks/useGenerator";
import { useTemplates } from "../../hooks/useTemplates";
import { classifyFortiOSLine } from "../../lib/syntax";

import {
    DEFAULT_FIRMWARE,
    DEFAULT_SERIES,
    FALLBACK_INTERFACES,
    FIELDS,
    FIRMWARE_OPTIONS,
    INITIAL_CHOICES,
    INITIAL_NEIGHBORS,
    INITIAL_VALUES,
    SERIES_OPTIONS,
    assignDhcp,
    assignInterface,
    neighborFieldId,
    newNeighbor,
    outputFileName,
    resolveUplinks,
    templateFileName,
    templateUrl,
    validateNeighbors,
    type BgpNeighbor,
    type FirmwareVersion,
    type NeighborErrors,
    type FortigateOptions,
    type Series,
    type UplinkChoices,
    type UplinkRole,
} from "./definition";
import { generateConfig, inspectTemplate } from "./generate";
import { BgpSection } from "./BgpSection";
import { UplinkSection } from "./UplinkSection";

interface GeneratedConfig {
    content: string;
    filename: string;
}

/** Hoisted so the uplinks memo below doesn't see a new object on every render while loading. */
const NO_DEFAULTS = {};
const NO_NEIGHBOR_ERRORS: NeighborErrors = {};

export default function FortigateConfigurator({ onBack }: AppProps) {
    const [series, setSeries] = useState<Series>(DEFAULT_SERIES);
    const [firmware, setFirmware] = useState<FirmwareVersion>(DEFAULT_FIRMWARE);
    const [dualLink, setDualLink] = useState(false);
    const [choices, setChoices] = useState<UplinkChoices>(INITIAL_CHOICES);
    const [customBgp, setCustomBgp] = useState(false);
    const [neighbors, setNeighbors] = useState<readonly BgpNeighbor[]>(INITIAL_NEIGHBORS);
    const [showNeighborErrors, setShowNeighborErrors] = useState(false);

    const { status: templateStatus, template, error: templateError, retry } = useTemplates([
        templateUrl(series, firmware),
    ]);

    // Ports and default uplink positions come from the selected template, so 30G and 40F each
    // offer their own. Falls back to a fixed list until the template is loaded, or when its
    // ports can't be read.
    const layout = useMemo(() => (template ? inspectTemplate(template) : null), [template]);
    const ports = layout && layout.ports.length > 0 ? layout.ports : FALLBACK_INTERFACES;
    const uplinks = useMemo(
        () => resolveUplinks(choices, ports, layout?.defaults ?? NO_DEFAULTS),
        [choices, ports, layout],
    );

    const options = useMemo<FortigateOptions>(
        () => ({ dualLink, uplinks, customBgp, neighbors }),
        [dualLink, uplinks, customBgp, neighbors],
    );
    const form = useConfigForm({ initialValues: INITIAL_VALUES, fields: FIELDS, context: options });
    const generator = useGenerator<GeneratedConfig>({ series, firmware, options, values: form.trimmedValues });

    // Like the form, neighbor errors show after the first Generate and then follow the typing.
    const neighborErrors: NeighborErrors =
        customBgp && showNeighborErrors ? validateNeighbors(neighbors, form.values.bgp_as) : NO_NEIGHBOR_ERRORS;

    // Picking a port pins both uplinks, so a later template switch can't move the other one.
    const changeInterface = (role: UplinkRole, next: string) => setChoices(assignInterface(uplinks, role, next));
    const changeDhcp = (role: UplinkRole, dhcp: boolean) => setChoices((current) => assignDhcp(current, role, dhcp));

    const changeNeighbor = (id: number, patch: Partial<Omit<BgpNeighbor, "id">>) =>
        setNeighbors((current) => current.map((neighbor) => (neighbor.id === id ? { ...neighbor, ...patch } : neighbor)));
    // A new peer is a backup once there is a main one, since a second main is the rarer case.
    const addNeighbor = () =>
        setNeighbors((current) => [
            ...current,
            newNeighbor(
                Math.max(0, ...current.map((neighbor) => neighbor.id)) + 1,
                current.some((neighbor) => neighbor.role === "main") ? "backup" : "main",
            ),
        ]);
    const removeNeighbor = (id: number) => setNeighbors((current) => current.filter((neighbor) => neighbor.id !== id));

    /** True when every neighbor is usable; otherwise shows the errors and focuses the first one. */
    const validateBgp = (focus: boolean): boolean => {
        if (!customBgp) return true;
        setShowNeighborErrors(true);
        const errors = validateNeighbors(neighbors, form.values.bgp_as);
        const first = neighbors.find((neighbor) => errors[neighbor.id]);
        if (first && focus) {
            const field = errors[first.id].ip ? "ip" : "remoteAs";
            requestAnimationFrame(() => document.getElementById(neighborFieldId(first.id, field))?.focus());
        }
        return !first;
    };

    const handleGenerate = () => {
        if (!template) return;
        const formOk = form.validate();
        // The form focuses its own first error; the neighbors only when the form is fine.
        const bgpOk = validateBgp(formOk);
        if (!formOk || !bgpOk) return;
        generator.run(() => {
            const { content, warnings } = generateConfig(template, form.trimmedValues, options);
            return { output: { content, filename: outputFileName(form.trimmedValues.hostname) }, warnings };
        });
    };

    const handleReset = () => {
        form.reset();
        setDualLink(false);
        setChoices(INITIAL_CHOICES);
        setCustomBgp(false);
        setNeighbors(INITIAL_NEIGHBORS);
        setShowNeighborErrors(false);
        generator.clear();
    };

    return (
        <ConfiguratorLayout
            title="FortiGate Configuration Generator"
            subtitle="Internet use only"
            logo="/icons/fortilogo.ico"
            onBack={onBack}
            onReset={handleReset}
            dirty={form.dirty || neighbors !== INITIAL_NEIGHBORS}
            onGenerate={handleGenerate}
            ready={templateStatus === "ready"}
            toast={generator.toast}
            onDismissToast={generator.dismissToast}
            preview={
                <ConfigPreview
                    filename={generator.output?.filename ?? outputFileName("")}
                    content={generator.output?.content ?? null}
                    state={generator.state}
                    classifyLine={classifyFortiOSLine}
                />
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
                <FieldGrid fields={form.fieldsIn("device")} {...form.fieldProps} />
            </FormSection>

            <FormSection title="Options">
                <div className="grid grid-cols-2 gap-3">
                    <ToggleCard
                        label="Dual Link"
                        description="Adds a secondary link"
                        checked={dualLink}
                        onChange={setDualLink}
                    />
                    <ToggleCard
                        label="Custom BGP"
                        description="Peers with the customer's providers"
                        checked={customBgp}
                        onChange={setCustomBgp}
                    />
                </div>
            </FormSection>

            <UplinkSection
                role="primary"
                title="Primary Link"
                uplink={uplinks.primary}
                ports={ports}
                other={dualLink ? { label: "Secondary Link", uplink: uplinks.secondary } : null}
                onInterfaceChange={(next) => changeInterface("primary", next)}
                onDhcpChange={(dhcp) => changeDhcp("primary", dhcp)}
                fields={form.fieldsIn("primary")}
                {...form.fieldProps}
            />

            {dualLink ? (
                <UplinkSection
                    role="secondary"
                    title="Secondary Link"
                    uplink={uplinks.secondary}
                    ports={ports}
                    other={{ label: "Primary Link", uplink: uplinks.primary }}
                    onInterfaceChange={(next) => changeInterface("secondary", next)}
                    onDhcpChange={(dhcp) => changeDhcp("secondary", dhcp)}
                    fields={form.fieldsIn("secondary")}
                    {...form.fieldProps}
                />
            ) : null}

            <FormSection title="LAN and Loopback">
                <FieldGrid fields={form.fieldsIn("network")} {...form.fieldProps} />
            </FormSection>

            {customBgp ? (
                <BgpSection
                    fields={form.fieldsIn("bgp")}
                    {...form.fieldProps}
                    neighbors={neighbors}
                    neighborErrors={neighborErrors}
                    onNeighborChange={changeNeighbor}
                    onAddNeighbor={addNeighbor}
                    onRemoveNeighbor={removeNeighbor}
                />
            ) : null}
        </ConfiguratorLayout>
    );
}
