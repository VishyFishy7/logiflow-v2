# Code Accessibility & Correctness Audit

**Date:** 2026-09-13
**Scope:** Interactive chrome, shared kit, forms, data tables, dialog/drawer focus trapping, mock↔contract alignment
**Method:** Static code review guided by WCAG 2.2 (ramS, accessibility, shadcn, web-design-guidelines skills)
**Note:** No dev server was running at audit time; all findings are from static code inspection.

---

## Findings

| # | Severity | Area | File:Line | Defect | Why it breaks | Evidence / Repro | Suggested Fix |
|---|----------|------|-----------|--------|---------------|------------------|---------------|
| 1 | **HIGH** | Notifications drawer | `app-shell/notifications-drawer.tsx:100-106` | Notification list-item buttons use `focus-visible:outline-none` but provide only a subtle background-color change (`focus-visible:bg-muted/60`) as the focus indicator — no ring, no outline | WCAG 1.4.11 requires a focus indicator with ≥3:1 contrast against the adjacent background. `bg-muted/60` against the default item background is a colour shift below that threshold; keyboard users may lose track of focus in a list of 10+ items | Add `focus-visible:ring-2 focus-visible:ring-ring` to the button className, matching the pattern used in `topbar.tsx:91` |
| 2 | **HIGH** | Settings – tracking toggle | `features/settings/tracking-section.tsx:85-101` | Custom `<button role="switch">` is not programmatically associated with its visible label. The `<Label>` at line 102 uses `onClick` to toggle the switch but has no `htmlFor` pointing to the button, and the button has no `id` | WCAG 1.3.1 / 4.1.2: a screen reader user tabbing to the switch hears only "On"/"Off" — the field name "Enable public tracking page" is not announced | Add `id="public-tracking-toggle"` to the `<button>` and `htmlFor="public-tracking-toggle"` to the `<Label>`, or wrap both in a `Field` + `FieldLabel` pair |
| 3 | **HIGH** | Shipment form – selects | `features/shipments/shipment-form.tsx:214-230` (Carrier), `:292-309` (Service level), `:312-330` (Payment mode), `:335-351` (Assign to) | `<Label>` elements lack `htmlFor` and `SelectTrigger` elements lack `id`. The label text ("Carrier *", "Service level *", "Payment mode *", "Assign to") is not programmatically linked to the Base UI Select control | WCAG 1.3.1: a screen reader user reaching the select trigger hears the selected option text but not the field label. The label association is visual only | Either (a) add `id` to each `SelectTrigger` and matching `htmlFor` on each `Label`, or (b) use Base UI's `Field` / `FieldLabel` which auto-wire `aria-labelledby` |
| 4 | **HIGH** | Settings – vocabulary inputs | `features/settings/vocabulary-section.tsx:74,93,119,137` | Delay-reasons and lead-sources `<Input>` fields lack `id` attributes; their `<Label>` elements lack `htmlFor`. The "Add delay reason…" and "Add lead source…" inputs at lines 93, 137 also lack `id` | WCAG 1.3.1: labels "Delay reasons" and "Lead sources" are not programmatically associated with any control. Screen reader users cannot identify which input they are filling | Add `id="new-delay-reason"` / `htmlFor="new-delay-reason"` and `id="new-lead-source"` / `htmlFor="new-lead-source"` to the add-item inputs. The list labels can use `aria-describedby` on each input to describe the list context |
| 5 | **HIGH** | Settings – raw select | `features/settings/tracking-section.tsx:67-82` | Raw native `<select>` with `outline-none` and `focus:border-ring focus:ring-3` (uses `focus:` not `focus-visible:`). The ring appears on every focus including mouse clicks, inconsistent with the rest of the form which uses `focus-visible:ring-*` | WCAG 2.4.7: removing the outline and replacing it with a ring on all focus is not wrong per se, but the mouse-click ring is noisy and the keyboard-only ring is the project convention — breaking it makes the focus style unpredictable across forms | Replace `outline-none focus:border-ring focus:ring-3 focus:ring-ring/50` with `focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none`, matching the `SelectTrigger` pattern at `spectrumui/select.tsx:43` |
| 6 | **MEDIUM** | Shared – PartialBanner | `shared/data-state.tsx:171-176` | The "Retry" action inside `PartialBanner` is a raw `<button>` without any focus-visible ring styles | Keyboard users see no visible focus indicator when tabbing to "Retry" in a degraded-data banner | Replace with `<Button size="sm" variant="ghost">` from `@/components/spectrumui/button`, which already includes `focus-visible:ring-3 focus-visible:ring-ring/50` |
| 7 | **MEDIUM** | Settings – state init | `features/settings/brand-section.tsx:33-42`, `tracking-section.tsx:28-35`, `vocabulary-section.tsx:27-31`, `tenant-section.tsx:28-35` | All four settings sections call `setForm(...)` inside the render body conditionally (`if (tenant && !initialized)`). This is a React anti-pattern — calling setState during render triggers double renders in StrictMode and can produce flickering or stale intermediate states | React docs: "Do not call setState during rendering." In StrictMode, the component renders twice, calling `setForm` four times total. The second render reads the stale `initialized=false` and overwrites the form | Move the initialization into a `useEffect(() => { if (tenant && !initialized) { setForm(...); setInitialized(true); } }, [tenant, initialized])` |
| 8 | **MEDIUM** | Styles – spacing convention | 115 instances across 31 files (see count below) | `space-y-*` / `space-y-0.5` used instead of `flex flex-col gap-*`. The shadcn skill marks "No `space-x-*` or `space-y-*`" as an always-enforced critical rule | Not an accessibility defect, but a consistent style convention violation. `space-y-*` doesn't work correctly with collapsed margins or adjacent elements; `flex gap-*` is layout-safe | Systematic find-and-replace: wrap containers in `flex flex-col gap-N` and remove `space-y-N`. Priority: `shipment-form.tsx` (16 hits), `client-form.tsx` (12), `checkpoint-log-dialog.tsx` (6), `invoice-form.tsx` (8) |
| 9 | **LOW** | Responsive overlay | `shared/responsive-overlay.tsx:23-35` | `useIsMobile` initializes as `false` (desktop) on first client render. On a mobile device, the initial paint shows the desktop Dialog layout before the `matchMedia` effect fires and swaps to the Vaul drawer | Causes a brief flash of desktop-style modal on mobile screens. Not an a11y defect, but a jarring UX on first load | Initialize with `typeof window !== 'undefined' ? window.matchMedia(...).matches : false` inside the useState initializer, or SSR with `null` and render nothing until the effect resolves |
| 10 | **LOW** | Command palette | `app-shell/command-palette.tsx:67-69` | Palette clears the search query on close but does not reset the scroll position of `CommandList`. Reopening after scrolling down reopens at the same scroll offset | Minor UX issue: the list appears to have residual state from the previous session | Add a `ref` to `CommandList` and call `ref.current?.scrollTo(0, 0)` inside the `useEffect` that clears the query |

---

## What I verified as correct

These areas were reviewed and found **free of defects**:

- **Skip link:** `app-shell.tsx:51-56` — properly renders a visually-hidden "Skip to content" link that becomes visible on focus and targets `<main id="main">`. WCAG 2.4.1 satisfied.
- **Page language:** `app/layout.tsx:52` — `<html lang="en-IN">` is set correctly.
- **Viewport zoom:** `app/layout.tsx:43` — `maximumScale: 5` allows pinch-to-zoom; never locked.
- **Base UI Dialog focus trapping:** `responsive-overlay.tsx:93-104` — `DialogTitle` and `DialogDescription` are always rendered. Base UI's `Dialog` traps focus and returns it to the trigger on close.
- **Vaul drawer focus trapping:** `responsive-overlay.tsx:63-90` — `Drawer.Title` and `Drawer.Description` are rendered. Vaul traps focus and returns it on close.
- **Command palette Dialog:** `command-palette.tsx:79-84` — `DialogTitle` and `DialogDescription` are both present (sr-only). Focus is managed by Base UI Dialog.
- **Sheet (notifications + mobile more):** `notifications-drawer.tsx:53-55`, `mobile-tabbar.tsx:97-107` — `SheetTitle` and `SheetDescription` are always rendered. Base UI Sheet handles focus trapping.
- **Icon-only buttons with labels:** All icon-only buttons in the topbar (`Search`, `Theme`, `Account`, `Notifications`) have `aria-label` attributes. Sidebar collapse button has `aria-label` at `app-sidebar.tsx:121`. Data pagination buttons have `aria-label` at `data-pagination.tsx:96,105`.
- **`nativeButton` misuse:** Only one instance of `nativeButton={false}` exists (`topbar.tsx:111`), and it is correctly applied to a `Button` rendering a `Link`. No remaining misuse found.
- **Non-semantic click handlers:** No `<div onClick>`, `<span onClick>`, or other non-interactive elements with click handlers were found. All interactive elements use native `<button>` or `<a>` elements.
- **Positive tabIndex:** No instances of `tabIndex > 0` found anywhere in the component tree.
- **Login form labels:** `login-form.tsx:53-76` — `FloatingLabelInput` components have `id`, `label`, and proper `aria-invalid` / `aria-describedby` for error messages. Error message uses `role="alert"` at line 82.
- **Shipment form error handling:** `shipment-form.tsx:136-152` — error messages are linked via `aria-describedby` and fields get `aria-invalid`. Client name input correctly uses this pattern.
- **Loading states:** `data-state.tsx:26` — `LoadingBlock` uses `role="status"` with `aria-label="Loading"`. `TableSkeleton` uses `role="status"` with `aria-label="Loading table"`.
- **Error states:** `data-state.tsx:128` — `ErrorBlock` uses `role="alert"`.
- **Data table keyboard navigation:** `spectrumui/data-table.tsx:1325-1328` — grid role with `aria-activedescendant`, `aria-multiselectable`, `tabIndex`, and `aria-busy`. Sort headers use `aria-sort`. Column resizers use `aria-orientation`, `aria-label`, `aria-valuenow`, `aria-valuemin`.
- **Reduced motion:** `app-shell.tsx:46` — `MotionConfig reducedMotion="user"` respects `prefers-reduced-motion` for all motion/react animations. `status-badge.tsx:142` — spinner uses `motion-reduce:animate-none`.
- **Colour-only information:** Status badges (`status-badge.tsx`) always pair colour with text labels and optional icons. Overdue markers (`shipments-table-columns.tsx:142`) use both a `Badge` with text and a colour change.
- **Mock↔contract alignment:** The `GET /shipments/stats` mock handler (`handlers.ts:523-628`) returns all fields required by `zAnalyticsStats` (`carrierPerformance`, `clientVolume`, `clientRevenue`) plus the base `zDashboardStats` fields. The mock `GET /auth/team` handler returns raw user objects which pass `zTeamMember` validation because `activeShipments` and `permissionCount` are `.optional()`. No field-shape mismatches found in the current codebase.
- **Notification bell count:** `topbar.tsx:121` — uses dynamic `aria-label` with unread count ("Notifications, N unread") for screen readers.

---

## Stats

| Category | Count |
|----------|-------|
| Blocker | 0 |
| High | 5 |
| Medium | 3 |
| Low | 2 |
| Total findings | 10 |
| `space-y-*` convention violations | 115 across 31 files |
