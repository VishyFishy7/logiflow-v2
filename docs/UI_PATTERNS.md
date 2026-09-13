# LogiFlow v2 — front-end patterns (read before writing any screen)

Every screen is assembled from the same parts. The shell, the page header, the
table chrome, the badges, the overlays and the states already exist — a page is
wiring, never a new design language. If a pattern is missing, add it to
`components/shared/` so the next screen inherits it; never inline a one-off.

Authoritative spec: `docs/PRD.md` (§11 names the Spectrum UI item each surface
must use, §12 the visual system, §13 responsive). This file only says **how** we
build in this repo.

---

## 1. Run it

```bash
pnpm --filter web dev            # http://localhost:3000 — mock mode by default (MSW)
pnpm exec tsc --noEmit           # run inside apps/web — must be clean for YOUR files
pnpm --filter web test           # vitest
```

`NEXT_PUBLIC_API_MODE=live` switches the app to the real route handlers backed by
SQLite. Mock mode needs no database — it is the default, so every screen must work
there. Demo logins are in `mocks/fixtures` / `docs/REFERENCE.md`.

## 2. Ownership — do not write outside your lane

| Path | Owner |
| --- | --- |
| `apps/web/components/app-shell/**` | parent (read-only) |
| `apps/web/components/shared/**` | parent (read-only; ask in your report if you need a change) |
| `apps/web/components/spectrumui/**` | registry components — read-only, except the one demo file your lane is told to convert |
| `apps/web/lib/**` (api, format, nav, store, list-state) | parent (read-only) |
| `apps/web/mocks/**`, `apps/web/app/api/**` | backend lanes (read-only) |
| `packages/**` | read-only |
| your `app/(app)/<section>/**` + `components/features/<section>/**` | you |

## 3. The page skeleton

```tsx
"use client";

import { PageHeader } from "@/components/shared/page-header";
import { Can } from "@/components/shared/permission-gate";

export default function ShipmentsPage() {
  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Shipments"
        description="Every consignment in the network, with live status."
        actions={
          <Can permission="shipment:create">
            <Button render={<Link href="/shipments/new" />}>New shipment</Button>
          </Can>
        }
      />
      {/* table / board / cards */}
    </div>
  );
}
```

- Route files are `page.tsx` client components; they read URL state with
  `useSearchParams()` and write it with `router.replace`/`push` (no local-only
  filter state — a filtered list must survive refresh and be shareable).
- Responsive: table on `md+`, stacked cards below. §13.
- Mobile: the bottom tab bar exists; keep primary actions reachable with the thumb.

## 4. Lists (table, server-paged)

`components/spectrumui/data-table.tsx` is the house table: sorting, quick-filter
pills, selection + bulk bar, row disclosure, hover row actions, sticky header,
column resize, totals, empty state, skeleton. **It does not fetch** — the page
fetches a page of rows and hands them over.

```tsx
const url = useListState({ defaults: { q: "", status: "all", page: 1, pageSize: 25 } });
const query = useShipments({
  q: url.state.q || undefined,
  status: url.state.status === "all" ? undefined : (url.state.status as ShipmentStatus),
  page: url.state.page,
  pageSize: url.state.pageSize,
  sort: url.state.sort, dir: url.state.dir,
});

<DataTable
  data={query.data?.data ?? []}
  columns={columns}            // DataTableColumn<ShipmentDTO>[]
  rowId={(row) => row.id}
  loading={query.isPending}
  skeletonRows={url.state.pageSize}
  emptyState={<EmptyState title="No shipments yet" … />}
  toolbar={<ShipmentFilters … />}       // your controls, chips/popovers only
  sort={{ id: url.state.sort, dir: url.state.dir }}
  onSortChange={(sort) => url.set({ sort: sort?.id ?? null, dir: sort?.dir ?? "desc", page: 1 })}
  onRowClick={(row) => router.push(`/shipments/${row.id}`)}
  keyboardNavigation
  selectable
  bulkActions={({ selectedIds, clear }) => <BulkAssign … />}
  totals={["amount"]}
/>
<DataPagination
  page={query.data?.page ?? 1}
  pageSize={query.data?.pageSize ?? url.state.pageSize}
  total={query.data?.total ?? 0}
  totalPages={query.data?.totalPages ?? 1}
  onPageChange={(page) => url.set({ page })}
  onPageSizeChange={(pageSize) => url.set({ pageSize, page: 1 })}
/>
```

- List envelope is `{ data, page, pageSize, total, totalPages }` — the field is
  **`data`**, not `items`.
- Column definitions: `DataTableColumn<T>` (`id`, `header`, `cell`, `sortable?`,
  `align?`, `width?`, `className?`). Numbers right-aligned and `tabular-nums`;
  identifiers in `font-identifier`; statuses via `<StatusBadge />`.
- `useListState` (`lib/list-state.ts`) owns `q/status/page/pageSize/sort/dir` in
  the URL and returns `{ state, set, setFilter, clearOne, isFiltered }`.
- Empty / filtered-empty / error / loading / partial are **all five** required
  states on every list.

## 5. Detail screens

- Drawers and dialogs: `components/shared/responsive-overlay.tsx` →
  `<ResponsiveOverlay open onOpenChange title description footer>` renders a
  centred dialog on `md+` and a bottom sheet on mobile (vaul). `ConfirmDialog`
  from the same file for anything destructive; never a bare `window.confirm`.
- Full detail pages: `PageHeader` with breadcrumb, then a two-column layout
  (`lg:grid-cols-[minmax(0,1fr)_320px]`) — the record on the left, the facts
  rail on the right.
- Timelines: `components/spectrumui/blocks/ai-assistants/status-tracker.tsx`
  (`StatusTracker`, props-driven).
- Inline empty/loading/error: `components/shared/data-state.tsx` —
  `DataState`, `LoadingBlock`, `TableSkeleton`, `EmptyState`, `ErrorBlock`,
  `PartialBanner`.

## 6. Writing

Every mutation is a React Query hook from `lib/api/queries.ts`. Wrap it:

```tsx
const save = useSaveLead();
const onSubmit = (values: LeadInput) =>
  save.mutate(values, {
    onSuccess: () => { toast.success("Lead saved"); close(); },
    onError: (error) => toast.error(errorMessage(error)),
  });
```

- Forms: `FloatingLabelInput` (`floating-label-input.tsx`) or `Input`/`Textarea`
  with a `Label`; validate with the zod input schemas from
  `@logiflow/contracts` (`zCreateShipmentInput`, …) — never re-declare a shape.
  Show field errors next to the field, with `aria-invalid` + `aria-describedby`.
- Submit buttons are `LoadingButton` (`loading-button-dependencies.tsx`).
- Toasts: `sonner` `toast.success` / `toast.error`. Success messages name the
  thing ("Shipment LFA-2411 created"), never "Success".
- Money is `money(paise)` from `lib/format.ts` — ₹, no decimals on whole rupees.
  Dates `dateTime()` / `relative()`. Labels `statusLabel` /
  `leadStatusLabel` / `invoiceStatusLabel` / `severityLabel` / `syncStateLabel`.
  Do not format a date or a currency by hand anywhere.

## 7. Colour, type, motion

- **Tokens only.** `bg-background`, `text-muted-foreground`, `border-border`,
  `bg-card`, `text-primary`, `bg-secondary`… Status hues come from
  `statusTone`-style helpers in `lib/format.ts` and `StatusBadge`. Never
  `text-blue-500`, never a raw hex, never a new CSS variable.
- One accent (sky blue). No green-for-success cards. **Amounts are the headline
  of their card, not a status chip** — status is a badge.
- Type: `text-[13px]` body density, `text-[22px] font-semibold
  tracking-[-0.01em]` page titles (PageHeader does this), `tabular-nums` for
  every number column.
- Motion: `motion/react`, 150–250ms, ease-out. Animate `opacity`/`transform`
  only. Honour `usePrefersReducedMotion`-style guards — no motion that changes
  meaning when it is off. Micro-interactions everywhere (hover, press, focus),
  nothing that delays a click.
- Focus states are visible on every interactive element; every icon-only button
  gets an `aria-label`; every form control gets a label; colour is never the only
  carrier of meaning (pair a status dot with its text).

## 8. Accessing data

All hooks live in `lib/api/queries.ts` — read it, do not add a fetch call:

- session/profile: `useSession`, `useUpdateProfile`, `useChangePassword`
- team: `useTeam`, `useInviteMember`, `useUpdateMember`
- shipments: `useShipments`, `useShipment`, `useCheckpoints`, `useShipmentStats`,
  `useCreateShipment`, `useUpdateShipment`, `useDeleteShipment`,
  `useLogCheckpoint`, `useRevealTracking`, `useBookCarrier`, `useSyncShipment`,
  `useBulkAssign`, `useBulkStatus`
- partners: `useClients`, `useCreateClient`, `useUpdateClient`, `useCarriers`,
  `useSaveCarrier`, `useRotateCarrierSecret`
- sales: `useLeads`, `useSaveLead`, `useLeadActivity`, `useConvertLead`
- money: `useInvoices`, `useInvoice`, `useSaveInvoice`
- governance: `useAuditLog`, `useNotifications`, `useMarkNotificationsRead`
- settings: `useSettings`, `useUpdateSettings(section)`
- public: `useTrackingLookup`

Permissions: gate UI with `<Can permission="…" fallback={…}>` or
`usePermissions()`; the server enforces the same `role → permission` map
(`docs/REFERENCE.md`), so a hidden control is never the only defence — but a
control a role cannot use must not be rendered enabled.

## 9. Definition of done for a screen

1. All five data states (loading, ready, empty, filtered-empty, error) render.
2. Works at 375px and 1440px; nothing overflows horizontally.
3. Mouse, keyboard and touch all reach every action; no hover-only information.
4. `pnpm exec tsc --noEmit` reports nothing for your files.
5. The screen looks like its siblings: same header, same table chrome, same
   badge shapes, same toast wording.
