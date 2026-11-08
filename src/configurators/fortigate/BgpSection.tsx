import { Plus, Trash2 } from "lucide-react";
import { FieldGrid, type FieldDisplay } from "../../components/configurator/FieldGrid";
import { FormSection } from "../../components/configurator/FormSection";
import { Button, IconButton } from "../../components/ui/Button";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { TextField } from "../../components/ui/TextField";
import type { FieldErrors } from "../../lib/validation";
import {
    NEIGHBOR_ROLE_OPTIONS,
    neighborFieldId,
    type BgpNeighbor,
    type FortigateFieldKey,
    type NeighborErrors,
} from "./definition";

interface BgpSectionProps {
    /** Router AS, router ID and advertised prefixes. */
    fields: readonly FieldDisplay<FortigateFieldKey>[];
    values: Record<FortigateFieldKey, string>;
    errors: FieldErrors<FortigateFieldKey>;
    onChange: (key: FortigateFieldKey, value: string) => void;
    neighbors: readonly BgpNeighbor[];
    neighborErrors: NeighborErrors;
    onNeighborChange: (id: number, patch: Partial<Omit<BgpNeighbor, "id">>) => void;
    onAddNeighbor: () => void;
    onRemoveNeighbor: (id: number) => void;
}

/** The router settings, then one card per provider peer. At least one neighbor stays in the list. */
export function BgpSection({
    fields,
    values,
    errors,
    onChange,
    neighbors,
    neighborErrors,
    onNeighborChange,
    onAddNeighbor,
    onRemoveNeighbor,
}: BgpSectionProps) {
    return (
        <FormSection
            title="Custom BGP"
            description="Backup neighbors get the router AS prepended 5 times, so providers prefer the main path."
        >
            <FieldGrid fields={fields} values={values} errors={errors} onChange={onChange} />

            <ul className="space-y-3">
                {neighbors.map((neighbor, index) => {
                    const error = neighborErrors[neighbor.id] ?? {};
                    return (
                        <li
                            key={neighbor.id}
                            className="space-y-3 rounded-lg border border-slate-200 p-3 dark:border-white/10"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                                    Neighbor {index + 1}
                                </h4>
                                <IconButton
                                    label={`Remove neighbor ${index + 1}`}
                                    onClick={() => onRemoveNeighbor(neighbor.id)}
                                    disabled={neighbors.length === 1}
                                    className="h-8 w-8 disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                </IconButton>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <TextField
                                    id={neighborFieldId(neighbor.id, "ip")}
                                    label="Peer IP"
                                    placeholder="e.g. 182.23.102.209"
                                    value={neighbor.ip}
                                    error={error.ip}
                                    onChange={(ip) => onNeighborChange(neighbor.id, { ip })}
                                />
                                <TextField
                                    id={neighborFieldId(neighbor.id, "remoteAs")}
                                    label="Remote AS"
                                    placeholder="e.g. 4800"
                                    value={neighbor.remoteAs}
                                    error={error.remoteAs}
                                    onChange={(remoteAs) => onNeighborChange(neighbor.id, { remoteAs })}
                                />
                            </div>
                            <SegmentedControl
                                name={`bgp-neighbor-${neighbor.id}-role`}
                                label="Role"
                                value={neighbor.role}
                                options={NEIGHBOR_ROLE_OPTIONS}
                                onChange={(role) => onNeighborChange(neighbor.id, { role })}
                            />
                        </li>
                    );
                })}
            </ul>

            <Button icon={<Plus className="h-4 w-4" />} onClick={onAddNeighbor} className="w-full">
                Add Neighbor
            </Button>
        </FormSection>
    );
}
