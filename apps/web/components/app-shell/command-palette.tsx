"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  Monitor,
  Moon,
  Package,
  Plus,
  Receipt,
  Search,
  Sun,
  Target,
} from "lucide-react";
import { useTheme } from "next-themes";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/spectrumui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/spectrumui/dialog";
import { useCan } from "@/components/shared/permission-gate";
import { useClients, useLeads, useSession, useShipments } from "@/lib/api/queries";
import { money, statusLabel } from "@/lib/format";
import { SECONDARY_SCREENS, visibleNav } from "@/lib/nav";
import { useDebounced } from "@/lib/list-state";
import { useUiStore } from "@/lib/store";
import { StatusBadge } from "@/components/shared/status-badge";

/**
 * §11.4 The ⌘K palette. One entry point for everything: navigate, act, or find
 * a shipment / client / lead by typing. This is why no screen needs its own
 * search box in the header.
 */
export function CommandPalette() {
  const router = useRouter();
  const open = useUiStore((state) => state.paletteOpen);
  const setOpen = useUiStore((state) => state.setPaletteOpen);
  const { data: session } = useSession();
  const { setTheme } = useTheme();

  const [query, setQuery] = useState("");
  const search = useDebounced(query.trim(), 250);
  const enabled = open && search.length >= 2;

  const canCreateShipment = useCan("shipment:create");
  const canManageLeads = useCan("lead:manage");
  const canManageClients = useCan("client:manage");
  const canManageInvoices = useCan("invoice:manage");

  const shipmentsQuery = useShipments({ q: search, page: 1, pageSize: 5 }, { enabled });
  const clientsQuery = useClients({ q: search, page: 1, pageSize: 5 }, { enabled });
  const leadsQuery = useLeads({ q: search, page: 1, pageSize: 5 }, { enabled });

  // A fresh palette every time — no stale results from the last open.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const groups = useMemo(() => visibleNav(session?.role ?? "viewer"), [session?.role]);

  function run(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-[560px]">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Jump to a screen, start an action, or find a shipment, client or lead.
        </DialogDescription>
        <Command shouldFilter={false} className="rounded-none! bg-transparent">
          <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search shipments, clients, leads — or type a command…"
      />
      <CommandList>
        <CommandEmpty>
          {search.length >= 2
            ? "No shipment, client or lead matches that."
            : "Type at least two characters to search."}
        </CommandEmpty>

        {enabled && (
          <>
            {(shipmentsQuery.data?.data.length ?? 0) > 0 && (
              <CommandGroup heading="Shipments">
                {shipmentsQuery.data?.data.map((shipment) => (
                  <CommandItem
                    key={shipment.id}
                    value={`shipment-${shipment.id}`}
                    onSelect={() => run(`/shipments/${shipment.id}`)}
                  >
                    <Package className="size-4 shrink-0 text-muted-foreground" />
                    <span className="font-identifier text-[12.5px]">{shipment.trackingId.value}</span>
                    <span className="truncate text-muted-foreground">{shipment.client.name}</span>
                    <span className="ml-auto flex items-center gap-2">
                      <span className="tabular hidden text-[11.5px] text-muted-foreground sm:inline">
                        {shipment.route.origin} → {shipment.route.destination}
                      </span>
                      <StatusBadge kind="shipment" size="sm" value={shipment.status} />
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {(clientsQuery.data?.data.length ?? 0) > 0 && (
              <CommandGroup heading="Clients">
                {clientsQuery.data?.data.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={`client-${client.id}`}
                    onSelect={() => run(`/clients/${client.id}`)}
                  >
                    <Building2 className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{client.name}</span>
                    <span className="ml-auto tabular text-[11.5px] text-muted-foreground">
                      {client.outstandingPaise ? money(client.outstandingPaise) : ""}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {(leadsQuery.data?.data.length ?? 0) > 0 && (
              <CommandGroup heading="Leads">
                {leadsQuery.data?.data.map((lead) => (
                  <CommandItem
                    key={lead.id}
                    value={`lead-${lead.id}`}
                    onSelect={() => run(`/leads?lead=${lead.id}`)}
                  >
                    <Target className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{lead.name}</span>
                    <span className="truncate text-muted-foreground">{lead.company}</span>
                    <span className="ml-auto">
                      <StatusBadge kind="lead" size="sm" value={lead.status} />
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Jump to">
          {groups.flatMap((group) =>
            group.items.map((item) => (
              <CommandItem key={item.href} value={`nav-${item.href}`} onSelect={() => run(item.href)}>
                <item.icon className="size-4 shrink-0 text-muted-foreground" />
                {item.label}
                <span className="ml-auto truncate text-[11.5px] text-muted-foreground">
                  {item.description}
                </span>
              </CommandItem>
            )),
          )}
          {SECONDARY_SCREENS.map((screen) => (
            <CommandItem
              key={screen.href}
              value={`nav-${screen.href}`}
              onSelect={() => run(screen.href)}
            >
              <Search className="size-4 shrink-0 text-muted-foreground" />
              {screen.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Create">
          {canCreateShipment && (
            <CommandItem value="create-shipment" onSelect={() => run("/shipments/new")}>
              <Plus className="size-4 shrink-0 text-muted-foreground" />
              New shipment
            </CommandItem>
          )}
          {canManageLeads && (
            <CommandItem value="create-lead" onSelect={() => run("/leads?new=1")}>
              <Plus className="size-4 shrink-0 text-muted-foreground" />
              New lead
            </CommandItem>
          )}
          {canManageClients && (
            <CommandItem value="create-client" onSelect={() => run("/clients?new=1")}>
              <Plus className="size-4 shrink-0 text-muted-foreground" />
              New client
            </CommandItem>
          )}
          {canManageInvoices && (
            <CommandItem value="create-invoice" onSelect={() => run("/invoices/new")}>
              <Receipt className="size-4 shrink-0 text-muted-foreground" />
              New invoice
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Appearance">
          <CommandItem
            value="theme-light"
            onSelect={() => {
              setTheme("light");
              setOpen(false);
            }}
          >
            <Sun className="size-4 shrink-0 text-muted-foreground" />
            Light theme
          </CommandItem>
          <CommandItem
            value="theme-dark"
            onSelect={() => {
              setTheme("dark");
              setOpen(false);
            }}
          >
            <Moon className="size-4 shrink-0 text-muted-foreground" />
            Dark theme
          </CommandItem>
          <CommandItem
            value="theme-system"
            onSelect={() => {
              setTheme("system");
              setOpen(false);
            }}
          >
            <Monitor className="size-4 shrink-0 text-muted-foreground" />
            Match system
          </CommandItem>
        </CommandGroup>
      </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

// Kept for callers that want the same wording as the list column headers.
export const paletteStatusLabel = statusLabel;
