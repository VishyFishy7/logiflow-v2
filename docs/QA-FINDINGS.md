# QA Findings — LogiFlow v2 Test Suite

## Bugs Found and Fixed

### 1. `packages/shared/src/money.ts` — `trimZero` strips trailing zeros from integers
**File:** `packages/shared/src/money.ts`, line 64  
**Symptom:** `formatMoneyCompact(50000)` returned `"₹5"` instead of `"₹500"`  
**Root cause:** `trimZero` applied `/\.?0+$/` regex to ALL numbers, stripping trailing zeros from integer strings like `"500"` → `"5"`  
**Fix:** Only apply the regex when the fixed string contains a decimal point  
**Before:** `return value.toFixed(value >= 100 ? 0 : 2).replace(/\.?0+$/, "");`  
**After:** Only strip trailing zeros after a decimal point — never from integers  

### 2. `packages/contracts/src/fixtures.ts` — `buildAudit` used `Date.now()` instead of `now` parameter
**File:** `packages/contracts/src/fixtures.ts`, line 674  
**Symptom:** `demoDataset(fixedNow)` produced non-deterministic audit events (timestamps varied per call)  
**Root cause:** `buildAudit` hard-coded `Date.now()` for the initial stamp instead of using the `now` parameter passed through `demoDataset`  
**Fix:** Changed `let stamp = Date.now() - 26 * DAY;` to `let stamp = now - 26 * DAY;` and added `now` parameter to the function signature  
**Before:** `function buildAudit(tenant, users, shipments, invoices): AuditEventDTO[]`  
**After:** `function buildAudit(tenant, users, shipments, invoices, now: number): AuditEventDTO[]`  

### 3. `packages/contracts/src/fixtures.ts` — Non-deterministic tracking IDs via CSPRNG
**File:** `packages/contracts/src/fixtures.ts`, line 384  
**Symptom:** `demoDataset(fixedNow)` produced different tracking IDs on each call  
**Root cause:** `generateTrackingId` (from `@logiflow/shared`) uses `crypto.getRandomValues()` which is non-deterministic  
**Fix:** Added `deterministicTrackingId` helper that uses the seeded PRNG from the fixture, and replaced the call  
**Before:** `const trackingId = generateTrackingId(tenant.trackingPrefix);`  
**After:** `const trackingId = deterministicTrackingId(tenant.trackingPrefix, r);`  

## Documented Issues (not fixed — outside ownership scope)

No issues were documented because all tests passed after the three fixes above.

## Test Coverage Summary

| Test File | Tests | Package |
|-----------|-------|---------|
| tracking.test.ts | 32 | shared |
| mask.test.ts | 21 | shared |
| money.test.ts | 20 | shared |
| dates.test.ts | 19 | shared |
| rbac.test.ts | 32 | shared |
| csv.test.ts | 18 | shared |
| routes.test.ts | 10 | contracts |
| fixtures.test.ts | 30 | contracts |
| shipments.test.ts | 25 | db |
| verify-audit.test.ts | 7 | db |
| **Total** | **214** | **10 files** |
