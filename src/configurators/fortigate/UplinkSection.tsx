import { FieldGrid, type FieldDisplay } from "../../components/configurator/FieldGrid";
import { FormSection } from "../../components/configurator/FormSection";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { SelectField } from "../../components/ui/SelectField";
import type { FieldErrors } from "../../lib/validation";
import {
    UPLINK_INTERFACES,
    type FortigateFieldKey,
    type Uplink,
    type UplinkRole,
} from "./definition";

type Addressing = "static" | "dhcp";

const ADDRESSING_OPTIONS: ReadonlyArray<{ value: Addressing; label: string }> = [
    { value: "static", label: "Static" },
    { value: "dhcp", label: "DHCP" },
];

interface UplinkSectionProps {
    role: UplinkRole;
    title: string;
    uplink: Uplink;
    /** The other link, shown next to its port in the list. Null when there is no other link. */
    other: { label: string; uplink: Uplink } | null;
    onInterfaceChange: (next: string) => void;
    onDhcpChange: (dhcp: boolean) => void;
    fields: readonly FieldDisplay<FortigateFieldKey>[];
    values: Record<FortigateFieldKey, string>;
    errors: FieldErrors<FortigateFieldKey>;
    onChange: (key: FortigateFieldKey, value: string) => void;
}

/** Everything about one uplink: which port it uses, static or DHCP, and its SID and IP. */
export function UplinkSection({
    role,
    title,
    uplink,
    other,
    onInterfaceChange,
    onDhcpChange,
    fields,
    values,
    errors,
    onChange,
}: UplinkSectionProps) {
    const interfaceOptions = UPLINK_INTERFACES.map((name) => ({
        value: name,
        label: other && other.uplink.interface === name ? `${name} (${other.label})` : name,
    }));

    return (
        <FormSection title={title}>
            <div className="grid grid-cols-2 gap-4">
                <SelectField
                    id={`select-interface-${role}`}
                    label="Interface"
                    value={uplink.interface}
                    options={interfaceOptions}
                    onChange={onInterfaceChange}
                />
                <SegmentedControl
                    name={`addressing-${role}`}
                    label="Addressing"
                    value={uplink.dhcp ? "dhcp" : "static"}
                    options={ADDRESSING_OPTIONS}
                    onChange={(mode) => onDhcpChange(mode === "dhcp")}
                />
            </div>

            <FieldGrid fields={fields} values={values} errors={errors} onChange={onChange} />

            {uplink.dhcp && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    The address and gateway come from DHCP, so no IP is needed.
                </p>
            )}
        </FormSection>
    );
}
