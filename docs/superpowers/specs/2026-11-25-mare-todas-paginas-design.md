# The "Maré" look across the whole operator panel

Date: 2026-11-25. Owner: Rits Delgado.

## Intent

After the new "Maré" dashboard went live, the owner wants every other page of the operator panel to share its look, so the app reads as one product with one identity. The pages include bookings, calendar, units, customers, finance, staff, growth and settings.

The owner:
- chose approach A: the base components take the new look;
- granted the exception to the standing rule that `components/ui/*` never changes, for looks only;
- approved the visual proposal ("sim, avança").

**Approved proposal:** canvas "Novo painel SalDesk", https://claude.ai/artifact/6VQVVNFKj6wH8v48xcUCMJ. The artboards that matter here:
- **"Reservas (página típica)"** (`Reservas.dc.html`): a list page.
- **"Componentes base"** (`Componentes.dc.html`): every base component in the new look.
- The dashboard artboards (`Main`, `Resumo`, `Movel`) show the same language on the home screen, which is already live.

Figures in the artboards are sample data.

## How it works today

- **Shell.** The operator app lives in `components/layout/Layout.jsx`. It marks its root with `data-ui="app"` and paints the ground with `app:bg-[var(--surface-app)]` (`#F1F4F6` in `styles/tokens.css`). `components/auth/AuthLayout.jsx` (login and registration) carries the same marker.
- **`app:` variant.** `tailwind.config.js` defines a Tailwind variant `app:` that applies only inside `[data-ui="app"]`. The November redesign used it so the base components look different in the operator app than in the portals (staff, beach seller, affiliate), the founder panel and the public pages.
- **Base components** (`components/ui/*`, about 790 lines):
  - Badge, Button, Card, ConfirmDialog, EmptyState, FilterChips, Input, Modal, RowMenu, Skeleton, Table, Tabs, Toast, Toggle;
  - they already have `app:` classes and `dark:` variants;
  - today's look: small radius (`rounded-sm`, 8 px), underline tabs, compact headings.
- **Page header.** `components/layout/PageHeader.jsx` (title, subtitle, actions) is used by about 42 pages.
- **The Maré dashboard** (live since 2026-11-25) already uses the new look in its own components under `components/dashboard/*`. The shared `DashboardHeader` and `AttentionPanel` were restyled there.
- **Pages:** about 60 operator pages, over 100 screen files outside `pages/admin`. About 55 use `ui/Card`. About 76 files outside `components/ui` draw their own cards and boxes with raw classes (`rounded-sm`, `border-n-200`), so they will not change from the base components alone.
- **Dark mode:** `uiStore.theme` defaults to `'system'`, so operators whose device is dark get dark mode where components have `dark:` classes.

## Approach (chosen by the owner: A)

- **A: the base components take the Maré look (chosen).**
  - The look changes once, in `components/ui/*`, the shell and `PageHeader`, all behind the `app:` variant. Every operator page changes together.
  - Then each area gets a polish pass for what the components cannot reach: hand-drawn cards, page-specific number tiles, charts.
  - Cost: one change touches every page at once, so review and verification must cover the whole panel.
- **B: keep `components/ui` frozen and restyle page by page.** Rejected by the owner: far more work, the same styles repeated in every page, and pages drifting apart over time.

## The look (from the approved proposal)

- **Ground:** a soft blue-grey (`#EEF2F4`) behind white cards.
- **Cards:** white with a 1 px `#DCE5EA` border, 18 px radius for page cards and 14 px for inner boxes, and generous padding (about 22 px).
- **Type:**
  - Sora for page titles (about 32 px on desktop) and card titles (18 px, semibold);
  - DM Sans for body text;
  - DM Mono for figures, dates, times and small eyebrow labels.
- **Page header:**
  - an optional eyebrow line in DM Mono (the menu section, e.g. "Operação");
  - the title, then a one-line subtitle;
  - actions on the right, wrapping under the title on phones;
  - no divider line.
- **Buttons:** pill shaped, at least 44 px tall.
  - **Primary:** sand `#D4A82A` with ocean-900 text, at most one per screen.
  - **Confirm:** ocean-900.
  - **Secondary:** white with an ocean-200 outline.
  - **Ghost and danger:** white with a red outline and red text.
  - Small size is 36 px, allowed only where 44 px does not fit and the target still has 44 px of hit area.
- **Tabs:** pills inside a rounded white track, with the active pill in ocean-900 and white text. An optional count sits inside the tab.
- **Filter chips:** pills with an outline; the active one is filled in ocean-900.
- **Fields:**
  - 44 px tall, with a 12 px radius and a `#C9D8E0` border;
  - labels in 13 px semibold, sentence case;
  - focus ring in sand;
  - errors in red with a plain-language hint.
- **Toggle:** a turquoise track when on.
- **Status badges:** pill shaped with a coloured dot plus text, so they still read without colour. The palette is fixed by the proposal:
  - pending: sand;
  - confirmed: ocean;
  - in progress / paid: turquoise;
  - done: neutral;
  - cancelled: red.
- **Tables:**
  - inside the card, with a quiet uppercase header row on `#F6F9FA`;
  - rows about 48 px tall, with figures in DM Mono;
  - row menus as 44 px round icon buttons;
  - sideways scroll inside the card on narrow screens.
- **Modal:** an 18 px radius, a soft shadow, a title in Sora and a 44 px close button.
- **Toast:** a dark ocean pill with an icon.
- **Empty state:** a soft panel with the small wave illustration, a title in Sora, one line of help and one action.
- **Sidebar:** stays ocean-900. The active item is ocean-700 and the section labels ocean-300 uppercase, as today and in the proposal.

## Goals

1. **Phase 1, base and shell.**
   - Restyle `components/ui/*`, `PageHeader` and the app shell to the look above, behind `app:`.
   - Behaviour, props, accessibility names and roles stay the same.
   - `PageHeader` gains one optional prop, `eyebrow`.
   - After phase 1, every operator page shows the new look in its base pieces.
2. **Phases 2 to 5, per area.** Restyle the hand-drawn cards, boxes, number tiles and charts of each area to match. The areas:
   - **Operação:** bookings, calendar, units, fleet, guides, maintenance, housekeeping, orders, digital menu.
   - **Clientes:** customers, messages, reviews, feedback, occurrences.
   - **Gestão:** finance, analytics, demand, weather, staff and HR.
   - **Crescimento and Definições:** automations, vouchers, loyalty, packages, groups, partners, affiliates, marketing, integrations, page editor, settings, profile.

   Each phase also replaces the page's ad-hoc pills and tabs with the base ones where they do the same job.
3. **Each phase ships on its own** (frontend only, app backup first) and is checked in the browser before deploy.

## Non-goals

- **Surfaces outside the operator app:**
  - staff portal, beach seller, affiliate portal (no `data-ui="app"`);
  - the founder panel (`pages/admin/*`, `AdminLayout`);
  - public and traveller pages.

  They keep their look. The login and registration screens (`AuthLayout`, which has `data-ui="app"`) do follow the base components; that is accepted.
- **Behaviour:** no new features, no layout or flow changes beyond the look (moving a button, merging pages). Texts and translations change only where a new label is needed.
- **Dark-mode polish.** Existing `dark:` variants are kept working, and new looks get a sensible dark counterpart, but a full dark-theme redesign is out of scope.
- **The dashboard's phase 2** (Hoje for hotel, rent-a-car, restaurant, generic). That is a separate project.
- **Backend, data and API changes.**

## Anti-goals

- **Broken behaviour hidden behind a look change.** A component's props, events, focus handling, ARIA roles, names and keyboard behaviour must stay the same. Existing component and page tests must pass with their behavioural assertions intact.
- **Leaking into the portals, founder panel or public pages.** Every new style sits behind `app:` or inside operator-only files.
- **Accessibility regressions:**
  - text contrast at least 4.5:1, or 3:1 for large text;
  - focus always visible;
  - touch targets at least 44 px;
  - status never told by colour alone.
- **Pages that look half-done** after phase 1, for example a page where a base pill sits next to an old square custom button, left for months. The area phases follow phase 1 promptly, in the order above.
- **Horizontal page scroll on phones.**

## Constraints

- **Stack:** React 18, Tailwind with the existing tokens. Add new token values (ground, card border, row-header ground) to `styles/tokens.css` and the Tailwind config, rather than hex literals scattered in files. No new dependency.
- **`components/ui/*` may change for looks only.** This is the owner's exception of 2026-11-25. Any prop added must be optional, and with it absent the component behaves as today.
- **i18n:** any new visible text goes in PT, EN, DE and NL. The whole-panel guard and the parity and accents tests stay green.
- **Comments and files:** comments in Portuguese without accents; keep each file's line endings; no emojis.
- **Verification:** each phase is checked in the browser preview against a fake API at 375 px and 1280 px before deploy. Use a session in `localStorage` `saldesk-auth`, as earlier redesign phases did. The real backend is never started locally.

## Builder calls (owner can overrule)

**`PageHeader` eyebrow:** the menu section name, taken from `navConfig`, shown only when the page passes `eyebrow`.

**Ground and tokens.** `--surface-app` becomes `#EEF2F4`, the proposal's ground. New tokens are added for:
- card border `#DCE5EA`;
- field border `#C9D8E0`;
- table-header ground `#F6F9FA`.

The live dashboard components move to these tokens in phase 1, replacing their hex values, so the home screen and the other pages share one source.

**Button sizes inside the app:**
- the default `md` becomes 44 px tall;
- `sm` becomes 36 px, for dense tables, toolbars and modal footers. There, the row or bar itself is at least 44 px, so no extra hit-area trick is needed;
- 225 buttons use the default and 133 use `sm` today. Their sizes are kept as chosen, and the area phases fix any toolbar that wraps badly at 375 px.

**Button variants:**
- `primary`: sand;
- `secondary`: white with an ocean-200 outline;
- `ghost`: transparent with ocean text, as today, in pill shape;
- `danger`: stays solid red, so destructive confirmations keep their weight. The proposal's outlined red is used only where a page shows a secondary destructive action;
- `accent`: used on dark and photo grounds such as the login; unchanged apart from the pill shape;
- a new optional variant `confirm`, in ocean-900, is added. Pages adopt it in the area phases.

**Badge variants mapped to the proposal's tones.** There are 14 variants today:
- pending, warning and preparing: sand;
- confirmed, info, direct and received: ocean;
- checked_in, ready and delivered: turquoise, which also covers "paid" and "success" meanings;
- checked_out, no_show and default: neutral;
- cancelled: red.

Green as a separate tone disappears; turquoise takes its role. Every variant keeps its dot plus text.

**`RowMenu` popup.** It is rendered in a portal on `document.body`, outside `data-ui="app"`. When its trigger sits inside the app, the portal element carries `data-ui="app"`, so the popup follows the new look; elsewhere it stays as today.

**Login screens.** They follow the new base components, because they share `data-ui="app"`. If a field does not read well on the dark or photo ground, an auth-only class keeps it readable. This is checked in the browser in phase 1.

**DM Mono for figures** is not a `Table` prop in phase 1. Pages apply it to their figure columns in the area phases.

**Tests:**
- assertions on class names, such as `rounded-sm`, may be updated as a pure look change;
- behavioural assertions (roles, names, events, values) may not be weakened.

**Browser check:**
- phase 1 checks a representative set at 375 px and 1280 px: dashboard, bookings, calendar, units, customers, finance, settings, a modal, a row menu, a toast and the login;
- each area phase checks every page of its area.

## Left to the builder

- Exact Tailwind classes and token names.
- How each base component maps its existing variants to the new look, as long as every existing variant keeps a distinct, accessible appearance.
- Which hand-drawn boxes in an area become `ui/Card` and which stay custom but restyled.
