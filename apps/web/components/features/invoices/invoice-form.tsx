"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

import {
  ResponsiveOverlay,
} from "@/components/shared/responsive-overlay";
import { LoadingButton } from "@/components/spectrumui/loading-button-dependencies";
import { Input } from "@/components/spectrumui/input";
import { Label } from "@/components/spectrumui/label";
import { Textarea } from "@/components/spectrumui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/spectrumui/select";
import { Button } from "@/components/spectrumui/button";
import { useSaveInvoice, useClients } from "@/lib/api/queries";
import { errorMessage } from "@/lib/api/client";
import type { InvoiceDTO, InvoiceCreateInput, InvoiceLineInput } from "@logiflow/contracts";
import { INVOICE_STATUS_LABELS, type InvoiceStatus } from "@logiflow/contracts";

interface LineItem {
  description: string;
  amountPaise: number;
  taxRateBp: number;
  shipmentId: string;
}

interface InvoiceFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: InvoiceDTO | null;
  onSuccess: () => void;
}

export function InvoiceFormSheet({
  open,
  onOpenChange,
  invoice,
  onSuccess,
}: InvoiceFormSheetProps) {
  const saveInvoice = useSaveInvoice(invoice?.id);
  const clientsResult = useClients({ pageSize: 200 });
  const isEditing = Boolean(invoice);

  const [clientId, setClientId] = useState(invoice?.client?.id ?? "");
  const [status, setStatus] = useState<InvoiceStatus>(invoice?.status ?? "pending");
  const [issueDate, setIssueDate] = useState(
    invoice?.issueDate
      ? new Date(invoice.issueDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0],
  );
  const [dueDate, setDueDate] = useState(
    invoice?.dueDate
      ? new Date(invoice.dueDate).toISOString().split("T")[0]
      : new Date(Date.now() + 30 * 86_400_000).toISOString().split("T")[0],
  );
  const [notes, setNotes] = useState(invoice?.notes ?? "");
  const [lines, setLines] = useState<LineItem[]>(
    invoice?.lines?.map((l) => ({
      description: l.description,
      amountPaise: l.amountPaise,
      taxRateBp: l.taxRateBp,
      shipmentId: l.shipmentId ?? "",
    })) ?? [
      { description: "", amountPaise: 0, taxRateBp: 1800, shipmentId: "" },
    ],
  );
  const [dueDateError, setDueDateError] = useState(false);
  const [clientError, setClientError] = useState(false);

  useEffect(() => {
    if (open) {
      setClientId(invoice?.client?.id ?? "");
      setStatus(invoice?.status ?? "pending");
      setIssueDate(
        invoice?.issueDate
          ? new Date(invoice.issueDate).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
      );
      setDueDate(
        invoice?.dueDate
          ? new Date(invoice.dueDate).toISOString().split("T")[0]
          : new Date(Date.now() + 30 * 86_400_000).toISOString().split("T")[0],
      );
      setNotes(invoice?.notes ?? "");
      setLines(
        invoice?.lines?.map((l) => ({
          description: l.description,
          amountPaise: l.amountPaise,
          taxRateBp: l.taxRateBp,
          shipmentId: l.shipmentId ?? "",
        })) ?? [
          { description: "", amountPaise: 0, taxRateBp: 1800, shipmentId: "" },
        ],
      );
      setDueDateError(false);
      setClientError(false);
    }
  }, [open, invoice]);

  const updateLine = (index: number, field: keyof LineItem, value: string | number) => {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, [field]: value } : l)));
  };

  const addLine = () => {
    setLines((prev) => [...prev, { description: "", amountPaise: 0, taxRateBp: 1800, shipmentId: "" }]);
  };

  const removeLine = (index: number) => {
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let hasError = false;
    if (!clientId) {
      setClientError(true);
      hasError = true;
    } else {
      setClientError(false);
    }
    if (!dueDate) {
      setDueDateError(true);
      hasError = true;
    } else {
      setDueDateError(false);
    }
    if (hasError) return;

    try {
      const inputLines: InvoiceLineInput[] = lines.map((l) => ({
        description: l.description,
        amountPaise: l.amountPaise,
        taxRateBp: l.taxRateBp,
        shipmentId: l.shipmentId || null,
      }));

      const input: InvoiceCreateInput = {
        clientId,
        status,
        issueDate: issueDate ? new Date(issueDate).getTime() : undefined,
        dueDate: new Date(dueDate).getTime(),
        notes: notes || undefined,
        lines: inputLines,
      };

      await saveInvoice.mutateAsync(input);
      toast.success(isEditing ? "Invoice updated" : "Invoice created");
      onSuccess();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const clients = clientsResult.data?.data ?? [];

  return (
    <ResponsiveOverlay
      open={open}
      onOpenChange={onOpenChange}
      title={isEditing ? `Edit invoice ${invoice?.number}` : "New invoice"}
      description="Create or update an invoice for a client."
      maxWidthClassName="sm:max-w-xl"
      footer={
        <>
          <button
            type="button"
            className="rounded-md px-3 py-2 text-[13px] font-medium text-muted-foreground hover:bg-muted transition-colors"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <LoadingButton
            onClick={onSubmit}
            loading={saveInvoice.isPending}
            disabled={saveInvoice.isPending}
          >
            {isEditing ? "Save changes" : "Create invoice"}
          </LoadingButton>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="invoice-client">Client</Label>
          <Select value={clientId} onValueChange={(v) => { setClientId(v ?? ""); setClientError(false); }}>
            <SelectTrigger id="invoice-client" aria-invalid={clientError}>
              <SelectValue placeholder="Select a client" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {clientError && (
            <p className="text-[var(--severity-error)] text-[12px]">Client is required</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="invoice-issue-date">Issue date</Label>
            <Input
              id="invoice-issue-date"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invoice-due-date">Due date</Label>
            <Input
              id="invoice-due-date"
              type="date"
              value={dueDate}
              onChange={(e) => { setDueDate(e.target.value); setDueDateError(false); }}
              aria-invalid={dueDateError}
            />
            {dueDateError && (
              <p className="text-[var(--severity-error)] text-[12px]">Due date is required</p>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="space-y-2">
            <Label htmlFor="invoice-status">Status</Label>
            <Select value={status} onValueChange={(v) => v && setStatus(v as InvoiceStatus)}>
              <SelectTrigger id="invoice-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Line items</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addLine}
            >
              <Plus className="size-3" />
              Add line
            </Button>
          </div>
          {lines.map((line, index) => (
            <div key={index} className="flex items-start gap-2 rounded-lg border border-border p-3">
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="Description"
                  value={line.description}
                  onChange={(e) => updateLine(index, "description", e.target.value)}
                  aria-label={`Line ${index + 1} description`}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    placeholder="Amount (paise)"
                    value={line.amountPaise || ""}
                    onChange={(e) => updateLine(index, "amountPaise", Number(e.target.value) || 0)}
                    aria-label={`Line ${index + 1} amount`}
                  />
                  <Input
                    type="number"
                    placeholder="Tax (bp)"
                    value={line.taxRateBp || ""}
                    onChange={(e) => updateLine(index, "taxRateBp", Number(e.target.value) || 0)}
                    aria-label={`Line ${index + 1} tax rate`}
                  />
                </div>
              </div>
              {lines.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeLine(index)}
                  aria-label={`Remove line ${index + 1}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label htmlFor="invoice-notes">Notes</Label>
          <Textarea
            id="invoice-notes"
            placeholder="Optional notes for this invoice"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </form>
    </ResponsiveOverlay>
  );
}
