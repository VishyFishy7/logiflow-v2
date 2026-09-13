'use client';

/**
 * Client detail overlay — opened via ?client=<id> URL param.
 * Shows full client information in a ResponsiveOverlay.
 */
import { useRouter } from 'next/navigation';
import { Building2, Mail, MapPin, Phone } from 'lucide-react';

import { Button } from '@/components/spectrumui/button';
import { LoadingButton } from '@/components/spectrumui/loading-button-dependencies';
import { ResponsiveOverlay } from '@/components/shared/responsive-overlay';
import { DetailField } from '@/components/shared/page-header';
import { Badge } from '@/components/spectrumui/badge';
import { useClients } from '@/lib/api/queries';
import { money, dateTime } from '@/lib/format';

export function ClientDetail({ clientId }: { clientId: string }) {
  const router = useRouter();

  // Find the client from the list data
  const clientsQuery = useClients({ page: 1, pageSize: 200 });
  const client = clientsQuery.data?.data.find((c) => c.id === clientId);

  function handleClose() {
    router.replace('/clients', { scroll: false });
  }

  if (!client && clientsQuery.isLoading) {
    return (
      <ResponsiveOverlay open onOpenChange={() => handleClose()} title="Loading…">
        <div className="py-12 text-center text-[13px] text-muted-foreground">
          Loading client details…
        </div>
      </ResponsiveOverlay>
    );
  }

  if (!client) {
    return (
      <ResponsiveOverlay open onOpenChange={() => handleClose()} title="Client not found">
        <div className="py-12 text-center text-[13px] text-muted-foreground">
          This client may have been deleted.
        </div>
      </ResponsiveOverlay>
    );
  }

  return (
    <ResponsiveOverlay
      open
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      title={client.name}
      description={client.contactName ?? undefined}
      maxWidthClassName="sm:max-w-lg"
    >
      <div className="space-y-5">
        <div className="flex items-center gap-2">
          <Badge variant={client.active ? 'default' : 'secondary'}>
            {client.active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {client.contactName && (
            <DetailField label="Contact">
              <span className="inline-flex items-center gap-1.5 text-[13px]">
                <Building2 className="size-3.5 text-muted-foreground" />
                {client.contactName}
              </span>
            </DetailField>
          )}
          {client.email && (
            <DetailField label="Email">
              <span className="inline-flex items-center gap-1.5 text-[13px]">
                <Mail className="size-3.5 text-muted-foreground" />
                {client.email}
              </span>
            </DetailField>
          )}
          {client.phone && (
            <DetailField label="Phone">
              <span className="inline-flex items-center gap-1.5 text-[13px]">
                <Phone className="size-3.5 text-muted-foreground" />
                {client.phone}
              </span>
            </DetailField>
          )}
        </div>

        {(client.city || client.state || client.addressLine1) && (
          <DetailField label="Address">
            <span className="inline-flex items-start gap-1.5 text-[13px]">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span>
                {client.addressLine1 && <>{client.addressLine1}<br /></>}
                {client.addressLine2 && <>{client.addressLine2}<br /></>}
                {[client.city, client.state, client.pincode].filter(Boolean).join(', ')}
              </span>
            </span>
          </DetailField>
        )}

        <div className="grid grid-cols-2 gap-4">
          {client.gstin && (
            <DetailField label="GSTIN">
              <span className="font-identifier text-[13px]">{client.gstin}</span>
            </DetailField>
          )}
          {client.creditTermsDays != null && (
            <DetailField label="Credit terms">
              <span className="text-[13px]">{client.creditTermsDays} days</span>
            </DetailField>
          )}
        </div>

        {client.outstandingPaise != null && client.outstandingPaise > 0 && (
          <DetailField label="Outstanding">
            <span className="text-[14px] font-medium tabular-nums">
              {money(client.outstandingPaise)}
            </span>
          </DetailField>
        )}

        {client.shipmentCount != null && (
          <DetailField label="Total shipments">
            <span className="text-[13px] tabular-nums">{client.shipmentCount}</span>
          </DetailField>
        )}

        <DetailField label="Created">
          <span className="text-[13px] tabular-nums">{dateTime(client.createdAt)}</span>
        </DetailField>
      </div>
    </ResponsiveOverlay>
  );
}
