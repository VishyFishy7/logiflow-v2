'use client';

/**
 * Activity feed for a lead — shows notes, calls, emails, status changes.
 * Uses the LeadActivityDTO shape from contracts.
 */
import { useState } from 'react';
import { Mail, MessageSquare, Phone, RefreshCw } from 'lucide-react';

import { Button } from '@/components/spectrumui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/spectrumui/select';
import { Textarea } from '@/components/spectrumui/textarea';
import { LoadingButton } from '@/components/spectrumui/loading-button-dependencies';
import type { LeadActivityDTO, LeadActivityKind } from '@logiflow/contracts';
import { useLeadActivity } from '@/lib/api/queries';
import { dateTime } from '@/lib/format';
import { errorMessage } from '@/lib/api/client';
import { toast } from 'sonner';

const KIND_ICONS: Record<LeadActivityKind, typeof MessageSquare> = {
  note: MessageSquare,
  call: Phone,
  email: Mail,
  status_change: RefreshCw,
};

const KIND_LABELS: Record<LeadActivityKind, string> = {
  note: 'Note',
  call: 'Call',
  email: 'Email',
  status_change: 'Status change',
};

export function LeadActivityFeed({
  leadId,
  activities = [],
}: {
  leadId: string;
  activities?: LeadActivityDTO[];
}) {
  const [kind, setKind] = useState<LeadActivityKind>('note');
  const [text, setText] = useState('');
  const addActivity = useLeadActivity(leadId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    addActivity.mutate(
      { kind, text: text.trim() },
      {
        onSuccess: () => {
          setText('');
          toast.success('Activity added');
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  }

  return (
    <div className="space-y-4">
      {/* Add form */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Select value={kind} onValueChange={(v) => setKind(v as LeadActivityKind)}>
          <SelectTrigger className="w-28 shrink-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(KIND_LABELS).map(([k, label]) => (
              <SelectItem key={k} value={k}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note, call log, or email…"
          rows={2}
          className="min-h-[36px] flex-1"
        />
        <LoadingButton
          type="submit"
          size="sm"
          loading={addActivity.isPending}
          disabled={!text.trim()}
          className="shrink-0 self-end"
        >
          Add
        </LoadingButton>
      </form>

      {/* Activity list */}
      {activities.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-muted-foreground">
          No activity yet.
        </p>
      ) : (
        <div className="space-y-3">
          {[...activities].reverse().map((activity) => {
            const Icon = KIND_ICONS[activity.kind];
            return (
              <div key={activity.id} className="flex gap-3">
                <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="size-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="font-medium">{activity.byUserName ?? 'System'}</span>
                    <span className="text-muted-foreground">
                      {KIND_LABELS[activity.kind]?.toLowerCase()}
                    </span>
                    <span className="ml-auto text-muted-foreground tabular-nums">
                      {dateTime(activity.createdAt)}
                    </span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    {activity.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
