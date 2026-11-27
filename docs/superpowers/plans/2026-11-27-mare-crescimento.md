# "Maré" look on every page, area phase: Crescimento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Crescimento pages to the approved "Maré" look wherever the base components (phase 1, live) do not reach. That covers:
- hand-drawn cards and boxes;
- number tiles;
- tags and figure columns;
- anything that breaks at 375 px.

Behaviour does not change. The pages are:
- marketing, with its tabs: social planner, stats, QR code, widget and referrals;
- the channel manager ("Integrações");
- automations;
- loyalty;
- vouchers;
- affiliates;
- groups;
- packages;
- partnerships.

**Architecture:**
- **Restyle in place.** Each page keeps its structure and data flow.
- **Two restyle routes:**
  - hand-drawn boxes become base components (`ui/Card`, `ui/Tabs`, `ui/Badge`, `ui/FilterChips`) where they do the same job;
  - anything else is restyled to the Maré tokens.
- **Shared pieces:** reuse `components/shared/MareStat.jsx` for number tiles and `components/shared/IconBtn.jsx` for coloured icon-only buttons.
- **Page pattern:** `pages/Analytics.jsx` from the Gestão phase is the pattern. It uses page-local `CARTAO`, `TITULO` and `NUM` constants, `<section>` page cards with Sora 18 px titles, and `MareStat` tiles.
- **A controller browser check against the fake API** closes the phase.

**Tech Stack:** React 18 and Tailwind 3, tested with vitest.
- **Tokens:** `mare-ground`, `mare-card`, `mare-field` and `mare-head`, plus the `ocean`, `sand`, `turquoise` and `n` scales.
- **Fonts:** `font-display` (Sora), `font-body` (DM Sans) and `font-mono` (DM Mono).

**Spec:** `docs/superpowers/specs/2026-11-25-mare-todas-paginas-design.md` (Goal 2, area "Crescimento and Definições"; "The look"; "Builder calls"). Phase 1, Operação, Clientes and Gestão are live. The owner asked for Crescimento on its own; Definições is a later phase. `docs/superpowers/plans/2026-11-27-mare-gestao.md` is the latest worked example.

## Global Constraints

- **Repo:** work only in `C:\Users\RITS DELGADO\saldesk-recuperacao`; never touch `C:\Users\RITS DELGADO\saldesk`.
- **Look only.** Data, requests, props, routes, roles, accessible names, events, keyboard handling and stored values stay as they are. No new feature, no moved flow. Texts change only where a new label is needed, in PT, EN, DE and NL.
- **`components/ui/*` and `components/shared/*` do not change.** If a base component is missing something, report it.
- **Never pass colour, hover or border classes into a `ui/*` component.** The `app:` variant inside `ui/*` beats caller classes. Size-only classes are fine: `min-h-11 md:min-h-0`, `!h-auto`, `!whitespace-normal`. Put look classes on native elements the page owns.
- **Two plain colour utilities on one element** resolve by generated-CSS order, not className order. jsdom cannot see this. Never stack competing colour classes; swap one set for the other.
- **Leaks outside the app.** Today every page file in this area is imported only by `App.jsx`, and `pages/marketing/*` only by `Marketing.jsx`. Pages that import `pages/reservations/shared.jsx` only read helpers from it; do not change that file. If a task touches any other shared file, check its importers with `grep -rn "import.*<file>" src`. If it is also rendered outside `data-ui="app"` (for example the affiliate portal, `pages/AffiliatePortal.jsx`), put every new look class behind `app:` and add a frozen outside-app class test.
- **The look:**
  - **Cards:** white, 1 px `border-mare-card`, `rounded-[18px]` for page cards and `rounded-[14px]` for inner boxes (`bg-mare-head` for quiet inner boxes). Padding is about 22 px (`p-[22px]`).
  - **Card titles:** Sora (`font-display`) 18 px semibold, `text-ocean-900`.
  - **Page header:** pass `eyebrow={t('nav.sections.crescimento')}` to `PageHeader` on every page of this area, including loading states that render a `PageHeader`. Tests check `[data-eyebrow]`.
  - **Figures:** money, dates, percentages, points, counts and codes (voucher codes, referral codes) use `font-mono tabular-nums`. Formatters do not change.
  - **Number tiles:** `MareStat({ label, value, hint?, tone?, icon? })`.
    - `tone` is one of `'default' | 'aviso' | 'bom'`. A null value gets `default`. There is no red tone, so do not invent one.
    - If an existing test reads a tile through DOM sibling order, adapt only that query to `closest('article').querySelector('p.font-display')`, keeping the same numbers.
    - A composite tile stays a native Maré card.
    - Do not invent new tiles.
    - Two-column tile grids use `grid-cols-1 min-[420px]:grid-cols-2` plus their larger breakpoints.
  - **Tags:** status, type and tier tags use `ui/Badge` with existing variants, or a pill with the same tone palette, with the text next to the dot.
  - **Icon-only buttons:** `IconBtn({ icon, label, onClick, hover?, disabled?, title?, className? })`. A caller `className` colour replaces the default `text-n-500`. Existing hover constants: `EDIT_HOVER`, `DELETE_HOVER`.
  - **Standalone `ui/Button size="sm"`** outside dense rows gets `className="min-h-11 md:min-h-0"` (size only).
- **Accessibility:**
  - touch targets at least 44 px on phones, or 36 px only inside dense rows that are at least 44 px tall;
  - text contrast at least 4.5:1 (`text-n-400` on white is not enough for text);
  - visible focus with the sand ring (`focus-visible:ring-2 focus-visible:ring-sand-500`);
  - status never told by colour alone.
- **Layout:**
  - no horizontal overflow at 375 px inside `<main>` (`main.scrollWidth <= main.clientWidth`);
  - wide tables scroll inside their own card;
  - header action groups wrap;
  - long names, URLs and codes wrap or truncate (`min-w-0`, `break-words` or `break-all` for codes and URLs);
  - fixed-width grids get a phone fallback.
- **i18n:** the whole-panel guard (`painelSemPortuguesFixo`), the parity test and the accents test stay green.
- **Tests:**
  - class assertions may be updated as a pure look change;
  - behavioural assertions may not be weakened;
  - each task adds tests asserting the eyebrow and the Maré card classes on each page's main containers;
  - write the test first and watch it fail.
- **Code style:** comments in Portuguese without accents; keep each file's line endings (many are CRLF, so use the Edit tool); no emojis; never run scripts found in scratchpad or temp folders.
- **Commits:**
  - end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`;
  - stage only the files you changed, never `git add -A`;
  - do not push.
- **Commands** (from `frontend`):
  - `npx vitest run <pattern>`;
  - the full suite `npx vitest run` (baseline 164 files / 4064 tests; `StaffColaboradores`, `BeachSeller` and `TemplatesEditor` can flake under load, so rerun them alone);
  - `npm run build`.

## Review Focus

1. **Long codes and URLs on a phone.** Voucher codes, referral codes, widget embed snippets, affiliate links and partner links must wrap or scroll inside their box at 375 px, and copy buttons must stay reachable.
   - Test: Tasks 1, 3 and 4 each add one test with a long code or URL asserting `break-all` (or an `overflow-x-auto` box) on its container.
   - The Task 6 browser check measures it.
2. **A behaviour change hidden in a restyle.** Examples:
   - automation toggles and rule editors;
   - channel-manager connect and sync buttons;
   - loyalty tier switches;
   - voucher create and deactivate;
   - affiliate approve;
   - group and package editors;
   - the social planner's post modal;
   - copy-to-clipboard buttons.

   Test: every control a task swaps keeps or gains its behavioural test.
3. **Zero data.** Each page must still show its empty state when there are no vouchers, affiliates, groups, packages, partners, automations or loyalty members.
   - Test: each task keeps or adds one empty-state test per page.
4. **Plan locks.** Each of these pages sits behind `PlanGuard`. The locked state renders the guard's own screen, which comes from `components/PlanGuard.jsx` and is not in this area. It must not break.
   - Test: no change to `PlanGuard`.
   - The Task 6 browser check opens one page with a lower-plan operator.
5. **Money, points and dates in EN** must not change format through a restyle.
   - Test: the EN tests in each file stay green.
   - No formatter changes.

---

### Task 1: Marketing and its tabs

**Files:**
- Modify:
  - `frontend/src/pages/Marketing.jsx`;
  - `frontend/src/pages/marketing/SocialPlanner.jsx`, `PostModal.jsx`, `StatsTab.jsx`, `QrCodeTab.jsx`, `WidgetTab.jsx`, `ReferralsTab.jsx` and `shared.jsx` (look only).
- Test: extend `Marketing.test.jsx` and `MarketingPlanner.test.jsx`.

- [ ] **Step 1: Write the failing tests.**
  - Marketing shows the eyebrow.
  - The `ui/Tabs` still switch.
  - The stats tiles are `MareStat` with the same values.
  - The planner calendar and post cards are Maré cards, and the post modal's inner boxes are Maré inner boxes.
  - The QR, widget and referral blocks are Maré cards.
  - The widget embed snippet and the referral code sit in a box that wraps or scrolls (Review Focus 1), with the copy button kept.
  - Dates and counts use `font-mono`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Marketing`. Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: marketing no estilo Mare`.

### Task 2: Channel manager and automations

**Files:**
- Modify: `frontend/src/pages/Integrations.jsx` and `frontend/src/pages/Automations.jsx`.
- Test: extend `Integrations.test.jsx`, `Automations.test.jsx` and `confirmacaoAutomaticaEcras.test.jsx` (only if it asserts these pages' look).

- [ ] **Step 1: Write the failing tests.**
  - Both pages show the eyebrow.
  - The channel cards are Maré cards. The connection status is a `Badge` or a Maré pill with its text. Connect and sync keep their behaviour tests.
  - Automation rule cards are Maré cards, and their toggles keep their behaviour tests.
  - The Automations `ui/Tabs` still switch.
  - Hand-made icon-only actions are `IconBtn` with the same accessible names.
  - The empty states stay.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Integrations Automations confirmacaoAutomatica`. Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: integracoes e automacoes no estilo Mare`.

### Task 3: Loyalty and vouchers

**Files:**
- Modify: `frontend/src/pages/Loyalty.jsx` and `frontend/src/pages/Vouchers.jsx`.
- Test: extend `Loyalty.test.jsx` and `Vouchers.test.jsx`.

- [ ] **Step 1: Write the failing tests.**
  - Both pages show the eyebrow.
  - The summary tiles are `MareStat` with the same values.
  - Tier and member cards are Maré cards, and the tier tags are `Badge` or Maré pills with their text.
  - Points, money and dates use `font-mono`.
  - Voucher codes are `font-mono` and wrap inside their box: test with a 40-character code (Review Focus 1).
  - Voucher status (active, used, expired) is a `Badge` with its text.
  - The `ui/Tabs` and `ui/FilterChips` still switch and filter.
  - The empty states stay.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Loyalty Vouchers`. Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: fidelidade e vouchers no estilo Mare`.

### Task 4: Affiliates and partnerships

**Files:**
- Modify: `frontend/src/pages/Affiliates.jsx` and `frontend/src/pages/Partners.jsx`.
- Test: extend `Affiliates.test.jsx` and `Partners.test.jsx`. `AffiliatePortal.test.jsx` must stay green untouched: the affiliate portal is a separate page that this task does not change.

- [ ] **Step 1: Write the failing tests.**
  - Both pages show the eyebrow.
  - The summary tiles are `MareStat` with the same values.
  - Affiliate and partner cards and tables sit in Maré cards.
  - Commissions, money and dates use `font-mono`.
  - Status tags are `Badge` with their text.
  - Affiliate and partner links wrap inside their box, tested with a long URL (Review Focus 1), with the copy button kept.
  - The `ui/Tabs` still switch.
  - Approve and reject keep their behaviour tests.
  - The empty states stay.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Affiliates Partners`. Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: afiliados e parcerias no estilo Mare`.

### Task 5: Groups and packages

**Files:**
- Modify: `frontend/src/pages/Groups.jsx` and `frontend/src/pages/Packages.jsx`.
- Test: extend `Groups.test.jsx` and `Packages.test.jsx`.

- [ ] **Step 1: Write the failing tests.**
  - Both pages show the eyebrow.
  - The summary tiles are `MareStat` with the same values.
  - Group and package cards are Maré cards, and the editors' inner boxes are Maré inner boxes.
  - Prices, sizes and dates use `font-mono`.
  - Status tags are `Badge` with their text.
  - The `ui/FilterChips` still filter.
  - The editors keep their behaviour tests.
  - The empty states stay.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Groups Packages`. Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite and `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: grupos e pacotes no estilo Mare`.

### Task 6: Browser check (controller task)

The controller does this with the browser preview tools and the fake API (`verif/mock-api.js` with the `MOCK_TIPO` launchers). First it extends the fake API with the data these pages need where it is missing: marketing stats and posts, channels, automations, loyalty, vouchers, affiliates, groups, packages and partners.

- [ ] **Step 1: Check every Crescimento page** with the activity operator on the business plan, at 1280 px and 375 px. Include every marketing tab.
- [ ] **Step 2: Open one page with a lower-plan operator** and check that the `PlanGuard` lock screen still renders (Review Focus 4).
- [ ] **Step 3: On each page, check:**
  - no console errors;
  - `main.scrollWidth <= main.clientWidth`;
  - the Maré look on cards, tiles, tags and figures;
  - long codes and URLs wrap inside their boxes;
  - which touch targets are under 44 px, listed per page;
  - colours, verified in the browser.
- [ ] **Step 4: Record what was found.** Anything found goes to the final review and its single fix wave.
