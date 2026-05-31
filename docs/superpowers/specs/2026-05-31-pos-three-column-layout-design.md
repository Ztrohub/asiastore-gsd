# POS Three-Column Layout Design

Date: 2026-05-31
Status: Approved in chat, pending written-spec review
Quick task: 260531-k2m

## Context

The current desktop POS page was recently constrained to fit inside one viewport without page scroll. That change solved the browser scrollbar regression, but it also forced the cart list to share one fixed-height column with discount input, totals, transaction note, and checkout actions. On a `1366x768` desktop viewport, the cart list can collapse to an almost unusable height.

The POS remains keyboard-first and offline-first. Any layout change must preserve the current shortcut contract and must stay usable on desktop, tablet, and mobile browsers.

## Problem Statement

The current desktop layout mixes two different classes of content inside the same height-constrained column:

- content that needs vertical room and benefits from scrolling as data grows: product list and cart list
- content that is mostly static or short-form: transaction summary, note, and checkout actions

When page scroll is removed at the desktop breakpoint, the static controls consume too much of the right column's available height, causing the cart list to shrink instead of remaining the primary working area.

## Goals

- Restore a legible cart list on desktop so cashiers can see roughly 5-6 full cart rows at `1366x768`, and more rows on taller screens.
- Keep the main POS page free of browser-level vertical scrolling on desktop.
- Give both the product list and cart list their own internal scroll containers on desktop and tablet landscape.
- Preserve the existing keyboard flow and shortcut behavior.
- Preserve the existing dialog cursor flow and fuzzy-search behavior exactly as they work today.
- Keep the layout usable on tablet landscape and mobile without introducing cramped tap targets.

## Non-Goals

- No behavior change to qty dialogs, cart edit dialogs, delete confirmation, void confirmation, payment dialogs, or receipt prompts.
- No new keyboard stops for the summary/action panel.
- No redesign of the underlying transaction model, pricing rules, or checkout logic.
- No change to shortcut mappings, dialog action navigation model, fuzzy-search ranking rules, or search-result highlighting behavior.

## Research Summary

The design direction is based on a combination of local UI audit and adaptive-layout references:

- Material responsive layout guidance recommends reflowing content by breakpoint and allows permanent side panels to squeeze primary content only when the screen can support them.
  Link: https://m1.material.io/layout/responsive-ui.html
- Android's adaptive list-detail guidance explicitly supports showing multiple panes side by side on large screens, then collapsing to fewer panes on smaller screens.
  Link: https://developer.android.com/develop/ui/compose/layouts/adaptive/list-detail?hl=en
- Shopify's mobile checkout guidance emphasizes simplicity, clear CTAs, and avoiding overloaded small screens.
  Link: https://www.shopify.com/enterprise/blog/mobile-checkout
- Shopify POS customization guidance supports customizing checkout-facing UI elements and payment option presentation, which aligns with separating checkout controls from browsing lists.
  Link: https://help.shopify.com/en/manual/sell-in-person/shopify-pos/customize-pos

## Root Cause Audit

The current `xl` desktop layout uses a fixed-height work area and moves overflow responsibility into inner panels. This is correct at the page level, but the right column still bundles all of the following together:

- cart list
- order discount input
- subtotal and total summary
- checkout action buttons
- transaction note textarea

Because the cart list is the only large repeating structure in that column, it becomes the area that loses height first. The "Enter to edit" helper text in every cart row also increases row height without adding meaningful value for trained cashier flow.

## Proposed Layout

### Breakpoints

- `< lg` (`<1024px`): one-column stacked layout; page scroll remains allowed
- `lg` to `< xl` (`1024px` to `1279px`): two-column layout; left = products, right = cart list with summary/action block below it
- `xl` and up (`>=1280px`): three-column layout; page remains locked to viewport height with no browser scroll

### Desktop Layout (`xl` and up)

- Search and shortcut header remain full-width at the top.
- Main work area becomes a 3-column grid:
  - Column 1: product list
  - Column 2: cart list
  - Column 3: transaction summary and actions
- Recommended width ratio:
  - products: `minmax(0, 2.2fr)`
  - cart: `minmax(0, 1.5fr)`
  - summary/actions: `minmax(280px, 1fr)`
- Column 1 and Column 2 both use `min-h-0` + `overflow-hidden` wrappers so their list bodies can own the available height and scroll internally.
- Column 3 stays statically visible and no longer steals height from the cart list.

### Tablet Landscape Layout (`lg` to `< xl`)

- The page uses 2 columns:
  - left: product list with internal scroll
  - right: cart list with internal scroll
- The summary/action panel moves below the cart list inside the right column.
- This keeps the cart and product lists readable without forcing a third narrow column onto a tablet.

### Mobile Layout (`< lg`)

- The page falls back to a single stacked column.
- Page scroll remains allowed.
- Product and cart sections are not forced into desktop-style fixed heights.

## Visual Density Rules

- Remove the helper text `Tekan Enter untuk edit qty/subtotal item` from every cart row.
- Reduce cart row vertical padding slightly while keeping rows easy to tap on tablet.
- Keep cart row structure as:
  - left: product name, then `qty x unit price`
  - right: line subtotal, then line discount
- Keep product rows compact but do not shrink them aggressively enough to harm tablet usability.
- Keep the global shortcut hint below search, but allow it to be tightened or line-broken more efficiently if needed.

## Component-Level Design

### `PosScreen`

- Owns the responsive grid and overall page composition.
- Continues to own `focusMode`, search state, note state, dialog state, payment state, and keyboard event handling.
- Renders the product list pane, cart list pane, and summary/action pane according to breakpoint.

### `PosProductTable`

- Remains the scrollable list for product results.
- Keeps current active-row highlighting and click/double-click behavior.
- Gains no new keyboard behavior.

### `PosCartPanel`

- Becomes a cart-list-focused pane instead of a mixed cart-and-checkout pane.
- Retains cart header, item count, empty state, active-row highlight, and row click behavior.
- Owns only the cart list body plus any cart-local empty state.

### New Summary/Action Pane

- Recommended extraction into a dedicated component such as `PosTransactionSummaryPanel`.
- Hosts:
  - order discount input
  - subtotal, item discount total, transaction discount, total
  - transaction note textarea
  - `Tunai`, `Transfer`, and `Void` buttons
- This separation clarifies responsibility and prevents future regressions where static controls accidentally consume list height again.

## Keyboard and Interaction Invariants

The following behaviors must remain unchanged:

- typing while not inside another editable control continues to route into global product search
- `ArrowUp` / `ArrowDown` navigate the currently active list
- `ArrowRight` moves focus mode from products to cart
- `ArrowLeft` moves focus mode back to products and returns focus to search
- `Enter` on products opens qty dialog
- `Enter` on cart opens cart-item edit dialog
- `Delete` on cart opens remove confirmation
- `F8`, `F9`, and `F10` continue to trigger cash, transfer, and void flows under the same conditions as today

The summary/action pane is intentionally not added to the arrow-key navigation loop. This keeps cashier flow short and preserves muscle memory.

## Frozen Behavior Contract

The layout refactor is allowed to move surfaces, resize panes, and extract components. It is not allowed to change the interaction contract below.

### Keyboard Flow

- The cashier can still start typing immediately without clicking the search field first.
- Search typing, `Enter`, qty confirmation, return-to-search focus, `ArrowRight` to cart, cart edit with `Enter`, and cart delete with `Delete` must remain identical to the current `PosScreen` behavior.
- `ArrowLeft` and `ArrowRight` semantics must stay exactly the same as today. They are not repurposed for the new summary/action pane.

### Cursor Flow

- White-cursor dialog action navigation stays exactly as-is.
- Left/right arrow movement across dialog footer actions must not change.
- Focus-ring styling and focus ownership in existing dialogs must remain identical to the current behavior.

### Shortcut Contract

- The reserved shortcut set in `src/lib/shortcuts/pos-contract.ts` must not change.
- `type-to-search`, `navigate-up`, `navigate-down`, `navigate-left`, `navigate-right`, `submit-item`, `void`, `cash-payment`, and `transfer-payment` remain mapped exactly as they are now.
- The summary/action pane can be clicked or tapped, but it must not introduce a different keyboard shortcut path.

### Fuzzy Search Flow

- The search algorithm, typo tolerance, out-of-order token handling, and ranking behavior must not change as part of this task.
- Search-result highlighting remains bold/strong in the same way it works today.
- The layout refactor may resize the product pane, but it may not change product search ordering, discoverability, or empty-state behavior.

## Error Handling and Behavioral Safety

- All existing validation and dialog error behavior remain where they are today.
- Any layout refactor must preserve disabled states for empty-cart actions.
- Scroll ownership must stay local to list bodies on desktop so the browser-level no-scroll guarantee is not broken.

## Verification Plan

- Keep the existing desktop no-page-scroll Playwright regression for `/app/pos`.
- Extend layout verification to confirm the desktop page still fits within `window.innerHeight` after the 3-column split.
- Re-run POS keyboard flow tests to prove that `ArrowLeft/ArrowRight`, `Enter`, `Delete`, `F8`, `F9`, and `F10` behaviors do not change.
- Re-run dialog cursor-flow tests to prove left/right dialog action movement and white-cursor focus styling do not change.
- Re-run fuzzy-search tests to prove ranking, typo tolerance, out-of-order matching, and bold highlight behavior do not change.
- Run responsive manual QA at:
  - desktop `1366x768`
  - tablet landscape `1024x768`
  - mobile `390x844`
- Validate that product list and cart list each scroll internally on desktop and tablet landscape.

Recommended automated verification set:

- `tests/pos/keyboard-cart-flow.spec.tsx`
- `tests/pos/dialog-action-navigation.spec.tsx`
- `tests/search/product-fuzzy-search.spec.ts`
- `tests/e2e/pos-keyboard-cart.spec.ts`

## Acceptance Criteria

- Desktop `xl` layout shows 3 columns with no browser-level vertical scrollbar.
- Product list and cart list each have independent internal scroll on desktop.
- Cart list remains visibly taller because summary, note, and actions have been moved out of the cart pane.
- Tablet landscape uses 2 columns with the summary/action block below the cart.
- Mobile remains usable as a stacked flow with normal page scrolling.
- Keyboard flow and shortcut behavior match the existing POS contract exactly.
- Dialog cursor flow matches the current white-cursor navigation exactly.
- Fuzzy search behavior, ordering, and highlight output match the current implementation exactly.
