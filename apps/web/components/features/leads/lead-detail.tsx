'use client';

/**
 * Lead detail overlay — opened via ?lead=<id> URL param (PRD §14.7).
 * Uses ResponsiveOverlay for the dialog/sheet responsive treatment.
 * Shows contact info, expected value, source, activity feed, and convert action.
 */
import { useRouter } from 'next/navigation';
import { Calendar, DollarSign, Mail, Phone, Tag, User2 } from 'lucide-react';

import { Badge } from '@/components/spectrumui/badge';
import { Button } from '@/components/spectrumui/button';
import { LoadingButton } from '@/components/spectrumui/loading-button-dependencies';
import {
  ResponsiveOverlay,
} from '@/components/shared/responsive-overlay';
import { StatusBadge } from '@/components/shared/status-badge';
import { DetailField } from '@/components/shared/page-header';
import { LeadActivityFeed } from './lead-activity-feed';
import { useLeads, useConvertLead, useSaveLead } from '@/lib/api/queries';
import { money, date } from '@/lib/format';
import { errorMessage } from '@/lib/api/client';
import { toast } from 'sonner';
import { LEAD_STATUS_LABELS, type LeadStatus } from '@logiflow/contracts';

export function LeadDetail({ leadId }: { leadId: string }) {
  const router = useRouter();

  // We need to find the lead from the list data — the list hook is already
  // active on the page. We query for all leads and find the one matching.
  const leadsQuery = useLeads({ page: 1, pageSize: 200 });
  const lead = leadsQuery.data?.data.find((l) => l.id === leadId);

  const convertLead = useConvertLead();
  const saveLead = useSaveLead();

  function handleClose() {
    router.replace('/leads', { scroll: false });
  }

  function handleConvert() {
    if (!lead) return;
    convertLead.mutate(
      { id: lead.id, input: {} },
      {
        onSuccess: () => {
          toast.success(`${lead.name} converted to a client`);
          handleClose();
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  }

  function handleStatusChange(newStatus: LeadStatus) {
    if (!lead) return;
    saveLead.mutate(
      { id: lead.id, input: { status: newStatus } },
      {
        onSuccess: () => {
          toast.success(`Lead moved to ${LEAD_STATUS_LABELS[newStatus]}`);
        },
        onError: (err) => toast.error(errorMessage(err)),
      },
    );
  }

  if (!lead && leadsQuery.isLoading) {
    return (
      <ResponsiveOverlay open onOpenChange={() => handleClose()} title="Loading…">
        <div className="py-12 text-center text-[13px] text-muted-foreground">
          Loading lead details…
        </div>
      </ResponsiveOverlay>
    );
  }

  if (!lead) {
    return (
      <ResponsiveOverlay open onOpenChange={() => handleClose()} title="Lead not found">
        <div className="py-12 text-center text-[13px] text-muted-foreground">
          This lead may have been deleted.
        </div>
      </ResponsiveOverlay>
    );
  }

  const nextStatuses = getNextStatuses(lead.status);

  return (
    <ResponsiveOverlay
      open
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      title={lead.name}
      description={lead.company}
      maxWidthClassName="sm:max-w-lg"
      footer={
        <div className="flex items-center gap-2 flex-wrap">
          {nextStatuses.length > 0 && (
            <>
              {nextStatuses.map((ns) => (
                <Button
                  key={ns}
                  variant={ns === 'won' ? 'default' : ns === 'lost' ? 'destructive' : 'outline'}
                  size="sm"
                  onClick={() => handleStatusChange(ns)}
                >
                  {LEAD_STATUS_LABELS[ns]}
                </Button>
              ))}
            </>
          )}
          {!lead.convertedClientId && lead.status !== 'lost' && (
            <LoadingButton
              size="sm"
              variant="default"
              loading={convertLead.isPending}
              onClick={handleConvert}
              className="ml-auto"
            >
              Convert to client
            </LoadingButton>
          )}
        </div>
      }
    >
      <div className="space-y-5">
        {/* Status + source */}
        <div className="flex items-center gap-2">
          <StatusBadge kind="lead" value={lead.status} />
          <Badge variant="outline" className="text-[11px]">
            <Tag className="mr-1 size-3" />
            {lead.source}
          </Badge>
        </div>

        {/* Contact details */}
        <div className="grid grid-cols-2 gap-4">
          {lead.email && (
            <DetailField label="Email">
              <span className="inline-flex items-center gap-1.5 text-[13px]">
                <Mail className="size-3.5 text-muted-foreground" />
                {lead.email}
              </span>
            </DetailField>
          )}
          {lead.phone && (
            <DetailField label="Phone">
              <span className="inline-flex items-center gap-1.5 text-[13px]">
                <Phone className="size-3.5 text-muted-foreground" />
                {lead.phone}
              </span>
            </DetailField>
          )}
        </div>

        {/* Value + dates */}
        <div className="grid grid-cols-2 gap-4">
          <DetailField label="Expected value">
            <span className="inline-flex items-center gap-1.5 text-[14px] font-medium tabular-nums">
              <DollarSign className="size-3.5 text-muted-foreground" />
              {money(lead.expectedValuePaise)}
            </span>
          </DetailField>
          <DetailField label="Follow-up">
            <span className="inline-flex items-center gap-1.5 text-[13px]">
              <Calendar className="size-3.5 text-muted-foreground" />
              {date(lead.nextFollowUp)}
            </span>
          </DetailField>
        </div>

        {lead.assignedTo && (
          <DetailField label="Assigned to">
            <span className="inline-flex items-center gap-1.5 text-[13px]">
              <User2 className="size-3.5 text-muted-foreground" />
              {lead.assignedTo.name}
            </span>
          </DetailField>
        )}

        {lead.notes && (
          <DetailField label="Notes">
            <p className="text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {lead.notes}
            </p>
          </DetailField>
        )}

        {lead.convertedClientId && (
          <div className="rounded-xl bg-[var(--status-won-bg)] px-3 py-2 text-[13px] text-[var(--status-won)]">
            ✓ Converted to client
          </div>
        )}

        {/* Activity feed */}
        <div>
          <h3 className="mb-3 text-sm font-medium">Activity</h3>
          <LeadActivityFeed leadId={lead.id} activities={lead.activities} />
        </div>
      </div>
    </ResponsiveOverlay>
  );
}

/** Valid next statuses for a lead given its current status. */
function getNextStatuses(current: LeadStatus): LeadStatus[] {
  switch (current) {
    case 'new':
      return ['contacted'];
    case 'contacted':
      return ['negotiation'];
    case 'negotiation':
      return ['won', 'lost'];
    case 'won':
    case 'lost':
      return [];
  }
}
