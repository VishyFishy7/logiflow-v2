"use client";

import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Plus, Save, X } from "lucide-react";

import { Button } from "@/components/spectrumui/button";
import { LoadingButton } from "@/components/spectrumui/loading-button-dependencies";
import { Input } from "@/components/spectrumui/input";
import { Label } from "@/components/spectrumui/label";
import { SectionCard } from "@/components/shared/page-header";
import { useSettings, useUpdateSettings } from "@/lib/api/queries";

/**
 * §14.11 Editable vocabulary — delay reasons and lead sources, currently
 * constants in v1. Uses `useUpdateSettings('vocabulary')`.
 */
export function VocabularySection() {
  const { data: tenant } = useSettings();
  const update = useUpdateSettings("vocabulary");
  const [delayReasons, setDelayReasons] = useState<string[]>([]);
  const [leadSources, setLeadSources] = useState<string[]>([]);
  const [newDelay, setNewDelay] = useState("");
  const [newSource, setNewSource] = useState("");
  const [initialized, setInitialized] = useState(false);

  if (tenant && !initialized) {
    setDelayReasons([...tenant.delayReasons]);
    setLeadSources([...tenant.leadSources]);
    setInitialized(true);
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    update.mutate({ delayReasons, leadSources }, {
      onSuccess: () => toast.success("Vocabulary saved"),
      onError: (err) => toast.error(err?.message || "Failed to save vocabulary"),
    });
  };

  const addDelayReason = () => {
    const trimmed = newDelay.trim();
    if (trimmed && !delayReasons.includes(trimmed)) {
      setDelayReasons((prev) => [...prev, trimmed]);
      setNewDelay("");
    }
  };

  const removeDelayReason = (idx: number) => {
    setDelayReasons((prev) => prev.filter((_, i) => i !== idx));
  };

  const addLeadSource = () => {
    const trimmed = newSource.trim();
    if (trimmed && !leadSources.includes(trimmed)) {
      setLeadSources((prev) => [...prev, trimmed]);
      setNewSource("");
    }
  };

  const removeLeadSource = (idx: number) => {
    setLeadSources((prev) => prev.filter((_, i) => i !== idx));
  };

  return (
    <form onSubmit={handleSubmit}>
      <SectionCard
        title="Vocabulary"
        description="Editable delay reasons and lead sources used across the app."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          {/* Delay reasons */}
          <div className="space-y-2">
            <Label>Delay reasons</Label>
            <div className="space-y-1.5">
              {delayReasons.map((reason, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="flex-1 truncate rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 text-[13px]">
                    {reason}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeDelayReason(idx)}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                    aria-label={`Remove delay reason: ${reason}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newDelay}
                onChange={(e) => setNewDelay(e.target.value)}
                placeholder="Add delay reason…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDelayReason();
                  }
                }}
                className="h-8"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={addDelayReason}
                aria-label="Add delay reason"
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Lead sources */}
          <div className="space-y-2">
            <Label>Lead sources</Label>
            <div className="space-y-1.5">
              {leadSources.map((source, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="flex-1 truncate rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 text-[13px]">
                    {source}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLeadSource(idx)}
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground"
                    aria-label={`Remove lead source: ${source}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newSource}
                onChange={(e) => setNewSource(e.target.value)}
                placeholder="Add lead source…"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLeadSource();
                  }
                }}
                className="h-8"
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                onClick={addLeadSource}
                aria-label="Add lead source"
              >
                <Plus className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <LoadingButton type="submit" loading={update.isPending}>
            <Save className="size-4" />
            Save vocabulary
          </LoadingButton>
        </div>
      </SectionCard>
    </form>
  );
}
