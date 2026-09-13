"use client";

/**
 * §14.4 Create shipment form.
 *
 * A simplified single-page form (we adapt the PRD's three-step concept into
 * a clean single form since a Dialog/drawer doesn't easily host steps).
 * Validates against `zShipmentCreateInput` from `@logiflow/contracts`.
 */
import { useState, useEffect } from "react";
import type { ShipmentCreateInput } from "@logiflow/contracts";
import {
  zShipmentCreateInput,
  SHIPMENT_STATUSES,
  SERVICE_LEVELS,
  PAYMENT_MODES,
  SERVICE_LEVEL_LABELS,
  PAYMENT_MODE_LABELS,
} from "@logiflow/contracts";
import { Button } from "@/components/spectrumui/button";
import { Input } from "@/components/spectrumui/input";
import { Label } from "@/components/spectrumui/label";
import { LoadingButton } from "@/components/spectrumui/loading-button-dependencies";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/spectrumui/select";
import { useCarriers, useTeam } from "@/lib/api/queries";
import { toast } from "sonner";

type ShipmentFormErrors = Partial<Record<keyof ShipmentCreateInput, string>>;

export interface ShipmentFormValues {
  client: string;
  carrierId: string;
  origin: string;
  destination: string;
  originPincode?: string;
  destinationPincode?: string;
  referenceNumber?: string;
  invoiceNumber?: string;
  packages: number;
  weightGrams: number;
  declaredValuePaise?: number;
  serviceLevel: ShipmentCreateInput["serviceLevel"];
  paymentMode: ShipmentCreateInput["paymentMode"];
  expectedDelivery?: number;
  assignedTo?: string | null;
  notes?: string;
  bookWithCarrier?: boolean;
}

const DEFAULTS: ShipmentFormValues = {
  client: "",
  carrierId: "",
  origin: "",
  destination: "",
  packages: 1,
  weightGrams: 1000,
  serviceLevel: "surface",
  paymentMode: "prepaid",
};

function validate(values: ShipmentFormValues): ShipmentFormErrors {
  const parsed = zShipmentCreateInput.safeParse(values);
  if (parsed.success) return {};
  const errors: ShipmentFormErrors = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as keyof ShipmentFormValues;
    if (key && !errors[key]) {
      errors[key] = issue.message;
    }
  }
  return errors;
}

export function ShipmentForm({
  onSubmit,
  onCancel,
  loading = false,
  initial,
}: {
  onSubmit: (values: ShipmentFormValues) => void;
  onCancel?: () => void;
  loading?: boolean;
  initial?: Partial<ShipmentFormValues>;
}) {
  const [values, setValues] = useState<ShipmentFormValues>({
    ...DEFAULTS,
    ...initial,
  });
  const [errors, setErrors] = useState<ShipmentFormErrors>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());

  const { data: carriersData } = useCarriers();
  const { data: teamData } = useTeam();

  const carriers = carriersData?.data ?? [];
  const teamMembers = teamData?.data ?? [];

  const set = (field: keyof ShipmentFormValues, value: unknown) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setTouched((prev) => new Set(prev).add(field));
    // Clear error for this field
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(values);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      // Mark all fields as touched so errors show
      setTouched(
        new Set(Object.keys(values) as Array<keyof ShipmentFormValues>),
      );
      toast.error("Please fix the highlighted fields");
      return;
    }
    onSubmit(values);
  };

  const fieldError = (field: keyof ShipmentFormValues) =>
    touched.has(field) && errors[field] ? errors[field] : undefined;

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {/* Client */}
      <div className="space-y-1.5">
        <Label htmlFor="client">Client name *</Label>
        <Input
          id="client"
          value={values.client}
          onChange={(e) => set("client", e.target.value)}
          placeholder="e.g. Acme Corp"
          aria-invalid={!!fieldError("client")}
          aria-describedby={fieldError("client") ? "client-error" : undefined}
        />
        {fieldError("client") && (
          <p id="client-error" className="text-xs text-destructive">
            {errors.client}
          </p>
        )}
      </div>

      {/* Origin & Destination */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="origin">Origin *</Label>
          <Input
            id="origin"
            value={values.origin}
            onChange={(e) => set("origin", e.target.value)}
            placeholder="e.g. Mumbai"
            aria-invalid={!!fieldError("origin")}
          />
          {fieldError("origin") && (
            <p className="text-xs text-destructive">{errors.origin}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="destination">Destination *</Label>
          <Input
            id="destination"
            value={values.destination}
            onChange={(e) => set("destination", e.target.value)}
            placeholder="e.g. Delhi"
            aria-invalid={!!fieldError("destination")}
          />
          {fieldError("destination") && (
            <p className="text-xs text-destructive">{errors.destination}</p>
          )}
        </div>
      </div>

      {/* Pincodes */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="originPincode">Origin pincode</Label>
          <Input
            id="originPincode"
            value={values.originPincode ?? ""}
            onChange={(e) => set("originPincode", e.target.value || undefined)}
            placeholder="400001"
            inputMode="numeric"
            maxLength={6}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="destinationPincode">Destination pincode</Label>
          <Input
            id="destinationPincode"
            value={values.destinationPincode ?? ""}
            onChange={(e) =>
              set("destinationPincode", e.target.value || undefined)
            }
            placeholder="110001"
            inputMode="numeric"
            maxLength={6}
          />
        </div>
      </div>

      {/* Carrier */}
      <div className="space-y-1.5">
        <Label>Carrier *</Label>
        <Select
          value={values.carrierId}
          onValueChange={(v) => set("carrierId", v)}
        >
          <SelectTrigger aria-invalid={!!fieldError("carrierId")}>
            <SelectValue placeholder="Select carrier" />
          </SelectTrigger>
          <SelectContent>
            {carriers.map((carrier) => (
              <SelectItem key={carrier.id} value={carrier.id}>
                {carrier.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {fieldError("carrierId") && (
          <p className="text-xs text-destructive">{errors.carrierId}</p>
        )}
      </div>

      {/* Packages, Weight, Value */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="packages">Packages *</Label>
          <Input
            id="packages"
            type="number"
            min={1}
            value={values.packages}
            onChange={(e) => set("packages", Number(e.target.value) || 1)}
            inputMode="numeric"
          />
          {fieldError("packages") && (
            <p className="text-xs text-destructive">{errors.packages}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="weightGrams">Weight (kg) *</Label>
          <Input
            id="weightGrams"
            type="number"
            min={1}
            value={Math.round(values.weightGrams / 1000)}
            onChange={(e) =>
              set("weightGrams", (Number(e.target.value) || 1) * 1000)
            }
            inputMode="numeric"
          />
          {fieldError("weightGrams") && (
            <p className="text-xs text-destructive">{errors.weightGrams}</p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="declaredValuePaise">Value (₹)</Label>
          <Input
            id="declaredValuePaise"
            type="number"
            min={0}
            value={values.declaredValuePaise
              ? Math.round(values.declaredValuePaise / 100)
              : ""}
            onChange={(e) =>
              set(
                "declaredValuePaise",
                e.target.value ? Number(e.target.value) * 100 : undefined,
              )
            }
            placeholder="0"
            inputMode="numeric"
          />
        </div>
      </div>

      {/* Service Level & Payment Mode */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Service level *</Label>
          <Select
            value={values.serviceLevel}
            onValueChange={(v) =>
              set("serviceLevel", v as ShipmentCreateInput["serviceLevel"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_LEVELS.map((sl) => (
                <SelectItem key={sl} value={sl}>
                  {SERVICE_LEVEL_LABELS[sl]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Payment mode *</Label>
          <Select
            value={values.paymentMode}
            onValueChange={(v) =>
              set("paymentMode", v as ShipmentCreateInput["paymentMode"])
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_MODES.map((pm) => (
                <SelectItem key={pm} value={pm}>
                  {PAYMENT_MODE_LABELS[pm]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Assignee */}
      <div className="space-y-1.5">
        <Label>Assign to</Label>
        <Select
          value={values.assignedTo ?? ""}
          onValueChange={(v) => set("assignedTo", v || null)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Unassigned</SelectItem>
            {teamMembers.map((member) => (
              <SelectItem key={member.id} value={member.id}>
                {member.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Reference & Invoice */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="referenceNumber">Reference #</Label>
          <Input
            id="referenceNumber"
            value={values.referenceNumber ?? ""}
            onChange={(e) => set("referenceNumber", e.target.value || undefined)}
            placeholder="PO / docket ref"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invoiceNumber">Invoice #</Label>
          <Input
            id="invoiceNumber"
            value={values.invoiceNumber ?? ""}
            onChange={(e) => set("invoiceNumber", e.target.value || undefined)}
            placeholder="Commercial invoice"
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <textarea
          id="notes"
          value={values.notes ?? ""}
          onChange={(e) => set("notes", e.target.value || undefined)}
          placeholder="Optional notes..."
          rows={2}
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <LoadingButton type="submit" loading={loading}>
          Create shipment
        </LoadingButton>
      </div>
    </form>
  );
}
