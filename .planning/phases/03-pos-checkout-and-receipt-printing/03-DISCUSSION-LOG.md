# Phase 3: POS Checkout and Receipt Printing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 3-POS Checkout and Receipt Printing
**Areas discussed:** Cart interaction flow, Discount behavior and guardrails, Payment capture and cash-drawer rules, Receipt printing control path

---

## Cart interaction flow

| Option | Description | Selected |
|--------|-------------|----------|
| Focus default | Global search vs last-focused vs product row | Global search + filter langsung |
| Add item action | Enter add langsung vs popup qty | Popup qty on Enter, Enter again confirm |
| Post-add focus | Return search vs stay row vs cart focus | Return ke product list/search |
| Cart edit/delete | Enter edit qty, Delete remove behavior | Enter edit qty popup; Delete with confirm dialog |
| Empty search result | No-op enter vs quick add product vs auto reset filter | Show "Produk tidak ditemukan", Enter no-op |
| Stock 0/minus | Soft warning vs hard block vs no warning | Soft warning and continue |
| Payment shortcut | F9 vs Ctrl+Enter vs Alt+P | F9 only |
| F9 precondition | Allow empty cart vs block empty | Block when cart empty |
| Qty validation | integer only vs decimal | >0 with decimal allowed |
| Decimal precision | 3/2/unlimited/custom | Max 1 decimal; >1 decimal truncate |
| Decimal separator | dot/comma policy | Accept `.` and `,` normalized |
| Transaction note | Optional note behavior | Stored in transaction; not printed |

**User's choice:** Keyboard-first flow anchored on search/list navigation with qty dialog and strict fast-path behavior.
**Notes:** User explicitly defined navigation model: search typing -> product row arrows -> Enter opens qty -> Enter confirms; ArrowRight to cart.

---

## Discount behavior and guardrails

| Option | Description | Selected |
|--------|-------------|----------|
| Discount order | Item-first vs order-first | Item-level first then order-level |
| Discount type | Flat IDR vs percent vs both | Flat IDR only |
| Item discount max | capped by line vs over-credit | Capped by line total |
| Order discount max | capped by post-item subtotal vs allow negative | Capped by subtotal after item discounts |

**User's choice:** Flat nominal discount only with strict non-negative guards.
**Notes:** No expansion to percentage discount in this phase.

---

## Payment capture and cash-drawer rules

| Option | Description | Selected |
|--------|-------------|----------|
| Cash input model | Received amount vs exact cash toggle vs manual change | Received amount + auto change |
| Default received amount | Empty/manual vs equals total | Default equals total transaction |
| Underpayment handling | Block vs warning vs debt | Block payment confirmation |
| Bank transfer metadata | No extra field vs reference fields required | No required extra field |
| Cash drawer policy | Include transfer in cash active vs exclude | Exclude from cash active, still recorded |

**User's choice:** Cash flow uses amount-received model; bank transfer excluded from active cash drawer.
**Notes:** Mid-discussion clarification requested for definition of "kas aktif" before final lock.

---

## Receipt printing control path

| Option | Description | Selected |
|--------|-------------|----------|
| Transaction completion point | After local save vs after successful print | Completed after successful local transaction save |
| Print prompt timing | immediate auto print vs ask print/not print | Prompt shown after transaction save |
| Prompt default | Print vs do not print | Default print |
| Print failure handling | Retry path vs no retry | Single attempt; error shown; no retry |
| UI after print attempt | Stay in print flow vs reset transaction UI | Always return to reset/new transaction state |
| No-print trace flag | explicit receipt flag vs implicit no-log | Implicit, no special flag |
| Receipt minimum content | minimal/extended choices | Header toko, id transaksi, item lines, subtotal/diskon/total, payment method, time, cashier |
| Transaction ID format | short human-readable vs UUID | Short human-readable |
| Long item names | wrap vs truncate | Wrap |
| Print success feedback | toast/modal/none | None |

**User's choice:** Print is post-commit optional path that never blocks cashier continuation.
**Notes:** User emphasized v1 simplicity: one print attempt and immediate return to new transaction mode.

---

## the agent's Discretion

- Final visual density/layout details for POS panels and dialogs.
- Exact microcopy wording for non-critical helper/error messages.
- Concrete short-id formatting suffix strategy consistent with existing ID generation patterns.

## Deferred Ideas

None.
