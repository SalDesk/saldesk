# "Maré" look on every page, area phase: Clientes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Clientes pages to the approved "Maré" look wherever the base components (phase 1, live) do not reach: hand-drawn cards and boxes, page number tiles, star breakdowns, chat panes, tags, figure columns and anything that breaks at 375 px. Behaviour does not change. Pages: customers (with the customer detail), messages, messages with SalDesk, reviews, occurrences and feedback.

**Architecture:**
- **Restyle in place.** Each page keeps its structure and data flow.
- **Two restyle routes:**
  - hand-drawn boxes become base components (`ui/Card`, `ui/Tabs`, `ui/Badge`, `ui/FilterChips`) where they do the same job;
  - anything else is restyled to the Maré tokens.
- **Reuse the Operação shared pieces:**
  - `components/shared/MareStat.jsx` for number tiles;
  - `components/shared/IconBtn.jsx` for coloured icon-only buttons.

  No new shared component unless two tasks need the same thing.
- **A controller browser check against the fake API** closes the phase.

**Tech Stack:** React 18, Tailwind 3. Tokens `mare-ground`, `mare-card`, `mare-field`, `mare-head`, plus the `ocean`, `sand`, `turquoise` and `n` scales. Fonts `font-display` Sora, `font-body` DM Sans, `font-mono` DM Mono. Tests in vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-mare-todas-paginas-design.md` (Goal 2, area Clientes; "The look"; "Builder calls"). Phase 1 and the Operação phase are live. The Operação plan, `docs/superpowers/plans/2026-11-26-mare-operacao.md`, is the worked example of this same pattern.

## Global Constraints

- **Repo.** Work only in `C:\Users\RITS DELGADO\saldesk-recuperacao`; never touch `C:\Users\RITS DELGADO\saldesk`.
- **Look only.** Data, requests, props, routes, roles, accessible names, events, keyboard handling, socket handling and stored values stay as they are. No new feature, no moved flow. Texts change only where a new label is needed, in PT, EN, DE and NL.
- **`components/ui/*` does not change.** If a base component is missing something, report it.
  - **Never pass colour, hover or border classes into a `ui/*` component.** The `app:` variant inside `ui/*` beats caller classes. Size-only classes are fine (`min-h-11 md:min-h-0`, `!h-auto`, `!whitespace-normal`).
  - Put look classes on native elements the page owns.
- **Leaks outside the app.** Every file in this area is operator-only today (`components/crm/*` is imported only by `pages/Customers.jsx`). If a task touches any other shared file, check it with `grep -rn "import.*<file>" src` and put every new look class behind `app:` when the file is also rendered outside `data-ui="app"`.
- **The look:**
  - **Cards:** white, 1 px `border-mare-card`, `rounded-[18px]` for page cards and `rounded-[14px]` for inner boxes (`bg-mare-head` for quiet inner boxes), padding about 22 px.
  - **Card titles:** Sora (`font-display`) 18 px semibold, `text-ocean-900`.
  - **Page header:** pass `eyebrow={t('nav.sections.clientes')}` to `PageHeader` on every page of this area. Tests check `[data-eyebrow]`.
  - **Figures:** money, dates, times, counts, ratings shown as numbers and references use `font-mono tabular-nums`. Formatters do not change.
  - **Number tiles:** `MareStat({ label, value, hint?, tone?, icon? })`, with `tone` one of `'default' | 'aviso' | 'bom'`.
    - If an existing test reads a tile through DOM sibling order, adapt only that query and keep the same numbers asserted.
    - Do not invent new tiles.
  - **Tags:** status, severity, type and visibility tags use `ui/Badge` with its existing variants, or a pill with the same tone palette. The text stays next to the dot.
  - **Icon-only buttons:** `IconBtn({ icon, label, onClick, hover?, disabled?, title?, className? })` from `components/shared/IconBtn.jsx`.
    - It is 44 px on phones.
    - A caller `className` colour replaces the default `text-n-500`.
- **Accessibility:**
  - touch targets at least 44 px on phones, or 36 px only inside dense rows that are themselves at least 44 px;
  - text contrast at least 4.5:1 (`text-n-400` on white is not enough for text);
  - visible focus with the sand ring (`focus-visible:ring-2 focus-visible:ring-sand-500`);
  - status never told by colour alone.
- **Layout.**
  - No horizontal overflow at 375 px inside `<main>` (`main.scrollWidth <= main.clientWidth`).
  - Wide tables scroll inside their own card.
  - Header action groups wrap (`flex-wrap`).
  - Long names and long messages wrap or truncate inside their box (`min-w-0`, `break-words`).
- **i18n:** the whole-panel guard (`painelSemPortuguesFixo`), parity and accents tests stay green.
- **Tests:**
  - class assertions may be updated as a pure look change;
  - behavioural assertions may not be weakened;
  - each task adds tests asserting the eyebrow and the Maré card classes on each page's main containers;
  - write the test first and watch it fail.
- **Code style:** comments in Portuguese without accents; keep each file's line endings (many are CRLF); no emojis.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.
- **Commands** (from `frontend`):
  - `npx vitest run <pattern>`;
  - the full suite `npx vitest run` (baseline 163 files / 3912 tests; `StaffColaboradores`, `BeachSeller` and `TemplatesEditor` can flake under load, so rerun them alone);
  - `npm run build`.

## Review Focus

1. **The chat panes on a phone.** Messages switches between the contact list and the conversation at 375 px. The restyle must keep that switch, the back control, the unread counts and the composer reachable, with no horizontal overflow from long messages or names.
   - Test: Task 2 keeps the existing mobile-switch tests and adds one with a 300-character unbroken message asserting the bubble carries `break-words`.
   - The Task 5 browser check measures it.
2. **Zero data.** No reviews (the star breakdown with total 0 must not produce `NaN` widths), no customers, no occurrences, no feedback.
   - Test: Task 3 renders `StarBreakdown` with `total: 0` and asserts every bar width is `0%`.
   - Tasks 1 and 4 keep or add their empty-state test.
3. **A behaviour change hidden in a restyle.** Examples:
   - the Feedback tabs must still switch;
   - the Customers segment chips must still filter;
   - the review reply flow must still open and send;
   - the occurrence severity and type tags must not become buttons.

   Test: every control a task swaps keeps or gains its behavioural test.
4. **Money and dates in EN** changing format through a restyle. Test: existing EN tests stay green; no formatter changes.
5. **Pages reachable only by some operator types:** occurrences (activity and rentacar) and feedback (activity). Test: the Task 5 browser check uses the activity operator for these and a hotel operator for the rest.

---

### Task 1: Customers and the customer detail

**Files:**
- Modify: `frontend/src/pages/Customers.jsx` and `frontend/src/components/crm/CustomerDetail.jsx`.
- Test: extend `frontend/src/__tests__/Customers.test.jsx` and `frontend/src/__tests__/CustomerDetail.test.jsx`.

**Interfaces:**
- Consumes `MareStat` (replaces the local `MetricCard` tiles, same labels and values) and `IconBtn` where a coloured icon-only button exists.

- [ ] **Step 1: Write the failing tests.**
  - Customers shows the eyebrow.
  - The four metric tiles are `MareStat` (`closest('article')`), with the same values as today.
  - The table sits in a Maré card.
  - Money and date cells use `font-mono`.
  - The new-customer and CSV-import modals keep every behavioural assertion; their inner boxes use `rounded-[14px] border-mare-card`.
  - CustomerDetail:
    - its sections are Maré inner boxes;
    - its money and dates use `font-mono`;
    - its tags are `Badge` or Maré pills with the same text.
  - The segment chips still filter, and the empty state still shows when there are no customers.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Customers CustomerDetail`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: clientes no estilo Mare`.

### Task 2: Messages and messages with SalDesk

**Files:**
- Modify: `frontend/src/pages/Messages.jsx` and `frontend/src/pages/FounderChat.jsx`.
- Test: extend `frontend/src/__tests__/Messages.test.jsx` and `frontend/src/__tests__/FounderChat.test.jsx`.

- [ ] **Step 1: Write the failing tests.**
  - Both pages show the eyebrow.
  - Messages:
    - the contact list and the conversation are Maré page cards;
    - the active contact row has a visible non-colour cue (for example `aria-current` or bold);
    - unread counts stay as text;
    - message bubbles carry `break-words` (with the 300-character unbroken message from Review Focus 1);
    - times use `font-mono`;
    - the composer sits in a Maré inner box;
    - the phone list/conversation switch and back control keep their tests.
  - FounderChat: the conversation is a Maré page card, bubbles carry `break-words`, times use `font-mono`, and the composer sits in a Maré inner box.
  - Icon-only send or back buttons that are hand-made become `IconBtn`, with the same accessible name.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Messages FounderChat`. Expected: FAIL.
- [ ] **Step 3: Implement** it. Do not touch the socket, polling or read-marking code.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: mensagens no estilo Mare`.

### Task 3: Reviews and feedback

**Files:**
- Modify: `frontend/src/pages/Reviews.jsx` and `frontend/src/pages/Feedback.jsx`.
- Test: extend `frontend/src/__tests__/Reviews.test.jsx` and `frontend/src/__tests__/Feedback.test.jsx`.

**Interfaces:**
- Consumes `MareStat` for the existing summary tiles:
  - Reviews: the `sm:grid-cols-3` row;
  - Feedback: the `lg:grid-cols-4` row.

- [ ] **Step 1: Write the failing tests.**
  - Both pages show the eyebrow.
  - Summary tiles are `MareStat`, with the same values as today.
  - Reviews:
    - review cards are Maré page cards;
    - the public/private tag stays `Badge`;
    - the rating number and dates use `font-mono`;
    - `StarBreakdown` sits in a Maré card, and with `total: 0` every bar width is `0%`;
    - the reply modal still opens and sends.
  - Feedback:
    - the `ui/Tabs` still switch;
    - the tables and survey cards sit in Maré cards;
    - dates and scores use `font-mono`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Reviews Feedback`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: avaliacoes e feedback no estilo Mare`.

### Task 4: Occurrences

**Files:**
- Modify: `frontend/src/pages/Occurrences.jsx`.
- Test: extend `frontend/src/__tests__/Occurrences.test.jsx`.

**Interfaces:**
- Consumes `MareStat` for the `lg:grid-cols-4` summary row, and `IconBtn` for hand-made icon-only actions.

- [ ] **Step 1: Write the failing tests.**
  - The page shows the eyebrow.
  - The summary tiles are `MareStat`, with the same values.
  - `TypeBadge` and `SeverityBadge` render `ui/Badge` (or a Maré pill), keep their text and are not buttons.
  - The table sits in a Maré card, with dates and amounts in `font-mono`.
  - The monthly report blocks are Maré cards.
  - The occurrence modal keeps its behavioural assertions, and its inner boxes use `rounded-[14px] border-mare-card`.
  - The empty state still shows with no occurrences.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Occurrences`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite and `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: ocorrencias no estilo Mare`.

### Task 5: Browser check (controller task)

The controller does this itself, with the browser preview tools and the fake API (`verif/mock-api.js` with the `MOCK_TIPO` launchers). It extends the API with customers, a few messages and groups, reviews and stats, occurrences and feedback, where they are missing.

- [ ] **Step 1: Check the pages at 1280 px and 375 px.**
  - **Activity operator:** every Clientes page (customers, messages, messages with SalDesk, reviews, occurrences, feedback).
  - **Hotel operator:** customers, messages and reviews.
- [ ] **Step 2: Check each page for:**
  - no console errors;
  - `main.scrollWidth <= main.clientWidth`;
  - the Maré look on cards, tiles, tags and figures;
  - the phone list/conversation switch in Messages;
  - touch targets under 44 px, listed per page;
  - colours verified in the browser (jsdom cannot see the cascade).
- [ ] **Step 3: Record what was found.** Anything found goes to the final review and its single fix wave.
