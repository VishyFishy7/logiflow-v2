"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/spectrumui/select";
import {
  AUDIT_SEVERITIES,
  AUDIT_ENTITY_TYPES,
} from "@logiflow/contracts";

const SEVERITY_LABELS: Record<string, string> = {
  info: "Info",
  warn: "Warning",
  error: "Error",
};

const ENTITY_LABELS: Record<string, string> = {
  shipment: "Shipment",
  checkpoint: "Checkpoint",
  tracking: "Tracking",
  client: "Client",
  carrier: "Carrier",
  lead: "Lead",
  invoice: "Invoice",
  team: "Team",
  auth: "Auth",
  settings: "Settings",
  export: "Export",
  system: "System",
};

interface AuditFiltersProps {
  severity: string;
  entityType: string;
  onSeverityChange: (severity: string) => void;
  onEntityTypeChange: (entityType: string) => void;
}

export function AuditFilters({
  severity,
  entityType,
  onSeverityChange,
  onEntityTypeChange,
}: AuditFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={severity} onValueChange={(v) => onSeverityChange(v ?? "all")}>
        <SelectTrigger aria-label="Filter by severity" className="h-8 w-[120px] text-[13px]">
          <SelectValue placeholder="Severity" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All severities</SelectItem>
          {AUDIT_SEVERITIES.map((s) => (
            <SelectItem key={s} value={s}>
              {SEVERITY_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={entityType} onValueChange={(v) => onEntityTypeChange(v ?? "all")}>
        <SelectTrigger aria-label="Filter by entity type" className="h-8 w-[140px] text-[13px]">
          <SelectValue placeholder="Entity type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All entities</SelectItem>
          {AUDIT_ENTITY_TYPES.map((e) => (
            <SelectItem key={e} value={e}>
              {ENTITY_LABELS[e] ?? e}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
