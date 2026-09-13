"use client";

/**
 * §14.3 Bulk actions for the shipments list.
 *
 * Bulk assign and bulk status change from the selection bar.
 */
import { useState } from "react";
import type { ShipmentStatus } from "@logiflow/contracts";
import {
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABELS,
} from "@logiflow/contracts";
import type { DataTableSelectionContext } from "@/components/spectrumui/data-table";
import type { ShipmentDTO } from "@logiflow/contracts";
import { Button } from "@/components/spectrumui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/spectrumui/select";
import { useBulkAssign, useBulkStatus, useTeam } from "@/lib/api/queries";
import { toast } from "sonner";
import { ResponsiveOverlay } from "@/components/shared/responsive-overlay";

export function BulkActions({
  ids,
  clear,
}: DataTableSelectionContext<ShipmentDTO>) {
  const [showAssign, setShowAssign] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [assignTo, setAssignTo] = useState("");
  const [bulkStatus, setBulkStatus] = useState<ShipmentStatus>("pickup");

  const bulkAssign = useBulkAssign();
  const bulkStatusMut = useBulkStatus();
  const { data: teamData } = useTeam();
  const teamMembers = teamData?.data ?? [];

  const selectedIds = ids;

  const handleAssign = () => {
    bulkAssign.mutate(
      { ids: selectedIds, assignedTo: assignTo || null },
      {
        onSuccess: () => {
          toast.success(`Assigned ${selectedIds.length} shipment(s)`);
          setShowAssign(false);
          clear();
        },
        onError: (err) => toast.error(err.message || "Bulk assign failed"),
      },
    );
  };

  const handleStatusChange = () => {
    bulkStatusMut.mutate(
      { ids: selectedIds, status: bulkStatus },
      {
        onSuccess: () => {
          toast.success(
            `Updated ${selectedIds.length} shipment(s) to ${SHIPMENT_STATUS_LABELS[bulkStatus]}`,
          );
          setShowStatus(false);
          clear();
        },
        onError: (err) =>
          toast.error(err.message || "Bulk status update failed"),
      },
    );
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowAssign(true)}>
          Assign ({selectedIds.length})
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowStatus(true)}>
          Change status ({selectedIds.length})
        </Button>
      </div>

      {/* Bulk Assign Dialog */}
      <ResponsiveOverlay
        open={showAssign}
        onOpenChange={setShowAssign}
        title="Assign shipments"
        description={`Assign ${selectedIds.length} selected shipment(s) to a team member.`}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowAssign(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssign} disabled={bulkAssign.isPending}>
              {bulkAssign.isPending ? "Assigning…" : "Assign"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Select
            value={assignTo}
            onValueChange={(v) => setAssignTo(v ?? "")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select team member" />
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
      </ResponsiveOverlay>

      {/* Bulk Status Dialog */}
      <ResponsiveOverlay
        open={showStatus}
        onOpenChange={setShowStatus}
        title="Change status"
        description={`Update status for ${selectedIds.length} selected shipment(s).`}
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowStatus(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleStatusChange}
              disabled={bulkStatusMut.isPending}
            >
              {bulkStatusMut.isPending ? "Updating…" : "Update status"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Select
            value={bulkStatus}
            onValueChange={(v) => { if (v) setBulkStatus(v as ShipmentStatus); }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SHIPMENT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {SHIPMENT_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </ResponsiveOverlay>
    </>
  );
}
