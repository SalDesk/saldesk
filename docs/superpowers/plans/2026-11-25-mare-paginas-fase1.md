# "Maré" look on every page, phase 1 (base components and app shell) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the shared base components, the page header and the operator app shell to the approved "Maré" look. Every operator page then changes at once, with no change in behaviour.

**Architecture:**
- **Tokens first.** New design tokens go in `styles/tokens.css`, exposed through `tailwind.config.js`.
- **`app:` variant.** Every visual change in `components/ui/*` and the shell sits behind the existing `app:` variant, which only applies inside `[data-ui="app"]` (`Layout.jsx`, `AuthLayout.jsx`). The portals, the founder panel and the public pages therefore keep today's look.
- **Same contract.** Components keep their props, roles, names and events. Only optional props are added.
- **Browser check.** A last task checks the result in the browser against a fake API.

**Tech Stack:** React 18, Vite, Tailwind 3 (tokens `ocean`, `sand`, `turquoise`, `n`; fonts `font-display` Sora, `font-body` DM Sans, `font-mono` DM Mono), vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-25-mare-todas-paginas-design.md`. Its "The look" and "Builder calls" sections are binding.

**Visual reference:** the approved canvas artboards. The controller copies them into the plan workspace as `proposta/`:
- `Componentes.dc.html` (every base component);
- `Reservas.dc.html` (a typical list page);
- `Main.dc.html` (the live dashboard, for the shell).

## Global Constraints

- **Repo:** work only in `C:\Users\RITS DELGADO\saldesk-recuperacao`. Never touch `C:\Users\RITS DELGADO\saldesk`.
- **`components/ui/*` may change for looks only** (owner's exception, 2026-11-25):
  - props, defaults, roles, accessible names, events and keyboard behaviour stay the same;
  - an added prop is optional, and without it the component behaves as today.
- **Every new style is behind `app:`**, or in files used only by the operator app. Outside `[data-ui="app"]` each component renders exactly today's classes.
- **Tokens** (spec builder calls):
  - `--surface-app` is `#EEF2F4`;
  - card border `#DCE5EA`;
  - field border `#C9D8E0`;
  - table-header ground `#F6F9FA`.

  No new hex literals in components; use the tokens.
- **Sizes inside the app:**
  - Button `md` is 44 px tall (`h-11`);
  - `sm` is 36 px (`h-9`);
  - `lg` stays at least 44 px;
  - every other touch target is at least 44 px.
- **Button variants:**
  - `primary`: sand;
  - `secondary`: white with an ocean-200 outline;
  - `ghost`: transparent with ocean text;
  - `danger`: stays solid red;
  - `accent`: unchanged apart from the shape;
  - **new optional variant `confirm`:** ocean-900 with white text;
  - all are pill shaped (`rounded-full`) in the app.
- **Badge tones** (each keeps a dot plus text):
  - `pending`, `warning`, `preparing`: sand;
  - `confirmed`, `info`, `direct`, `received`: ocean;
  - `checked_in`, `ready`, `delivered`: turquoise;
  - `checked_out`, `no_show`, `default`: neutral;
  - `cancelled`: red.
- **Accessibility:**
  - text contrast at least 4.5:1;
  - a visible focus ring in sand (`sand-500`) on every interactive base component;
  - status is never told by colour alone.
- **Dark mode:** keep every existing `dark:` class working. New app looks get a sensible `dark:` counterpart where the component had one.
- **i18n:** any new visible text goes in PT, EN, DE and NL. The whole-panel guard and the parity and accents tests stay green.
- **Tests:**
  - assertions on class names may be updated as a pure look change;
  - behavioural assertions (roles, names, events, values, counts) may not be weakened or removed.
- **Code style:**
  - comments in Portuguese without accents;
  - keep each file's line endings (many are CRLF: use the Edit tool, or Python preserving `\r\n`);
  - no emojis.
- **Commits** end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push.
- **Commands** (from `frontend`):
  - `npx vitest run <pattern>`;
  - full suite `npx vitest run` (baseline 159 files / 3774 tests; `StaffColaboradores` and `BeachSeller` can flake under load, so rerun them alone);
  - `npm run build`.

## Review Focus

1. **A look change that leaks outside the operator app.** The staff portal, beach seller, affiliate portal and founder panel render the same base components; they must look exactly as today. Test: each component task renders the component without a `data-ui="app"` ancestor and asserts today's key classes are still there, and that no app-only class is applied without the `app:` prefix.
2. **Behaviour silently changed while restyling.** Examples:
   - Tabs lose `aria-selected`;
   - a Toggle loses `role="switch"`;
   - the Modal close button loses its name;
   - RowMenu loses keyboard handling.

   Test: the existing behavioural tests stay intact, and each task adds one test per component asserting its role, name and state API inside the app.
3. **Touch targets and focus.** Every base interactive element is at least 44 px inside the app, or 36 px for `sm`, with a sand focus ring. Test: class assertions per component in Tasks 2 and 3.
4. **The `RowMenu` popup**, portalled to `document.body`, must follow the new look when opened from inside the app and keep today's look elsewhere. Test: Task 3.
5. **Pages that break at 375 px** once buttons grow from 36 to 44 px (toolbars wrapping, modal footers overflowing). Test: the Task 4 browser check at 375 px across the representative set. Any page that breaks is either fixed in Task 4, when it is a one-line wrap or gap fix, or recorded for its area phase.

---

### Task 1: Tokens, app shell and page header

**Files:**
- Modify:
  - `frontend/src/styles/tokens.css`: set `--surface-app` to `#EEF2F4` and add `--card-border` `#DCE5EA`, `--field-border` `#C9D8E0` and `--table-head` `#F6F9FA`, with dark counterparts in the existing `:root.dark` block;
  - `frontend/tailwind.config.js`: expose them as colours, e.g. `mare.card`, `mare.field`, `mare.head`, `mare.ground`.
- Modify:
  - `frontend/src/components/layout/Layout.jsx`: the ground token;
  - `Sidebar.jsx`, `Topbar.jsx`, `BottomNav.jsx`, `MoreDrawer.jsx`: align to the proposal. Sidebar is ocean-900, the active item ocean-700 and the section labels ocean-300 uppercase. Touch targets are at least 44 px. Changes are to looks only.
- Modify `frontend/src/components/layout/PageHeader.jsx`:
  - new optional prop `eyebrow`;
  - no bottom divider inside the app;
  - title in Sora at about 32 px on desktop and 26 px on phones;
  - subtitle at 14–15 px in `n-600`;
  - actions wrap under the title on phones.
- Modify the live dashboard components under `frontend/src/components/dashboard/*`: replace the hex values `#EEF2F4`, `#DCE5EA`, `#C9D8E0` and `#F6F9FA` (or their Tailwind arbitrary forms) with the new tokens.
- Test:
  - `frontend/src/__tests__/PageHeader.test.jsx` (new);
  - extend `Layout.test.jsx`, `Sidebar.test.jsx` and `Topbar.test.jsx`.

**Interfaces:**
- Produces:
  - `PageHeader({ title, subtitle, actions, eyebrow? })`;
  - Tailwind colour names for the four tokens, which Tasks 2 and 3 use (choose the names and list them in your report).

- [ ] **Step 1: Write the failing tests.**
  - `PageHeader` inside a `data-ui="app"` wrapper:
    - renders `eyebrow` when given;
    - has no `border-b` app class;
    - the title is an `h1` with the Sora class.
  - Outside the app it keeps today's classes, including `border-b`.
  - Without `eyebrow`, nothing extra renders.
  - The `Layout` root keeps `data-ui="app"` and uses the ground token.
  - Sidebar nav links keep their names and `aria-current`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run PageHeader Layout Sidebar Topbar`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite and `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: tokens Mare, moldura da app e cabecalho das paginas`.

### Task 2: Actions and inputs (Button, Input, Toggle, Tabs, FilterChips)

**Files:**
- Modify `frontend/src/components/ui/Button.jsx`:
  - app pill shape and the sizes above;
  - the new optional `confirm` variant (ocean-900, white text, hover ocean-800);
  - `secondary` becomes white with an ocean-200 outline and ocean-700 text;
  - `ghost` is a pill;
  - the focus ring is `sand-500` in the app.
- Modify `frontend/src/components/ui/Input.jsx` (text, select and textarea paths, whatever it renders):
  - inside the app: 44 px height, 12 px radius, `--field-border`;
  - labels in 13 px semibold, sentence case (already partly there);
  - sand focus ring;
  - error state in red with the hint.
- Modify `frontend/src/components/ui/Toggle.jsx`: a turquoise-600 track when on, and a hit area of at least 44 px.
- Modify `frontend/src/components/ui/Tabs.jsx`: inside the app, pills in a rounded white track bordered with `--card-border`. The active pill is ocean-900 with white text, and each pill is at least 40 px tall with a 44 px hit area. `aria-selected` and `role="tab"` are kept.
- Modify `frontend/src/components/ui/FilterChips.jsx`: inside the app, outlined pills at least 36 px tall; the active one is ocean-900 filled. The pressed state is kept.
- Test: extend `ui.test.jsx` and `uiAcessibilidade.test.jsx`.

**Interfaces:**
- Consumes: the Task 1 token colour names.
- Produces: `Button` with `variant` in `'primary'|'secondary'|'ghost'|'danger'|'accent'|'confirm'`; everything else unchanged.

- [ ] **Step 1: Write the failing tests.** Each test renders inside a `<div data-ui="app">` and outside it.
  - **Button:**
    - inside, `md` has `app:h-11` and `app:rounded-full`, and `sm` has `app:h-9`;
    - `confirm` renders the ocean-900 classes;
    - `danger` keeps the solid error background;
    - outside, the classes are exactly today's (the old `h-9` / `h-8` / `rounded-sm` without the `app:` override).
  - **Input:** has the app height and field-border classes, `aria-invalid` and the error hint are still wired, and the label is still associated.
  - **Toggle:** keeps its role and state, and is turquoise when on.
  - **Tabs:** clicking a tab still calls `onChange`; `aria-selected` is correct; the track classes are present in the app.
  - **FilterChips:** keeps its pressed state and `onChange`.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run ui uiAcessibilidade`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite and `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: botoes, campos, abas e filtros no estilo Mare`.

### Task 3: Containers and feedback (Card, Table, Badge, Modal, ConfirmDialog, Toast, EmptyState, Skeleton, RowMenu)

**Files:**
- Modify `frontend/src/components/ui/Card.jsx`: inside the app, an 18 px radius, the `--card-border` border and a white ground. The header is in Sora, 18 px semibold, with no grey bar. The default padding becomes about 22 px in the app; the `padding` prop still wins.
- Modify `frontend/src/components/ui/Table.jsx`: inside the app, the header row on `--table-head` in uppercase 12 px semibold `n-600` with letter-spacing, rows about 48 px tall with `n-100` dividers, and a hover tint. `compact`, `maxHeight` and the `text-right` behaviour asserted by the tests are kept.
- Modify `frontend/src/components/ui/Badge.jsx`: inside the app, pill tones per Global Constraints, each with a leading dot (a decorative `aria-hidden` span) plus the text.
- Modify `frontend/src/components/ui/Modal.jsx` and `ConfirmDialog.jsx`: inside the app, an 18 px radius, a soft shadow, the title in Sora and a 44 px close button whose name is kept.
- Modify `frontend/src/components/ui/Toast.jsx`: inside the app, a dark ocean-900 pill with an icon; the status role is kept.
- Modify `frontend/src/components/ui/EmptyState.jsx`: inside the app, a soft `--table-head` panel. When no `icon` is passed, it shows the small wave illustration from the proposal as an inline decorative SVG. The title is in Sora and the action is kept.
- Modify `frontend/src/components/ui/Skeleton.jsx`: the app radius matches the cards.
- Modify `frontend/src/components/ui/RowMenu.jsx`:
  - the trigger is a 44 px round icon button;
  - when the trigger is inside `[data-ui="app"]` (use `closest`), the portal container gets `data-ui="app"` so the popup takes the app look (rounded 14 px, `--card-border`, soft shadow, 44 px items);
  - elsewhere it stays as today;
  - keyboard handling and roles are unchanged.
- Test: extend `ui.test.jsx`, `Table.test.jsx`, `RowMenu.test.jsx`, `uiAcessibilidade.test.jsx` and `StatusBadge.test.jsx` if Badge markup changes.

- [ ] **Step 1: Write the failing tests.** Each renders inside and outside `data-ui="app"`.
  - **Card:** inside has the radius and border classes, outside keeps today's.
  - **Table:** inside has the header ground classes; the existing `px-4` / `px-2.5`, `text-right`, `max-h-40` and `overflow` assertions still hold (update any class string that changed purely for looks).
  - **Badge:**
    - inside, each of the 14 variants maps to its tone (for example `confirmed` uses the ocean tone and `checked_in` the turquoise tone);
    - each has a dot span with `aria-hidden`;
    - the visible text is unchanged;
    - outside, today's classes.
  - **Modal:** the close button keeps its accessible name and is at least 44 px in the app.
  - **ConfirmDialog:** keeps "Cancelar" / "Confirmar" behaviour, and `danger` still renders the destructive button.
  - **Toast:** keeps `role="status"`.
  - **EmptyState:** with no icon, shows a decorative `aria-hidden` SVG in the app; the title and action are kept.
  - **RowMenu:**
    - opened from inside the app, its popup container has `data-ui="app"`;
    - opened outside, it does not;
    - Escape and arrow keys behave as before.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run ui Table RowMenu uiAcessibilidade StatusBadge`. Expected: FAIL.
- [ ] **Step 3: Implement** it.
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite and `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: cartoes, tabelas, etiquetas, janelas e avisos no estilo Mare`.

### Task 4: Browser check against a fake API (controller task)

The controller does this task itself, with the browser preview tools. It is the spec's required browser check.

**Files:**
- Create, outside the repo or git-ignored:
  - `.claude/launch.json` with a `vite` dev-server entry, for example `npm run dev` in `frontend` on its port;
  - a small fake API script in the session scratchpad that answers the endpoints the representative pages call, with a plausible activity operator.

  Point the dev server at it through a local env override that is not committed.
- Modify: only for one-line fixes found in the check (a wrapping toolbar, a missing gap). Larger issues go to the area phases' list in the report.

- [ ] **Step 1: Prepare.** Start the dev server with `preview_start` and seed `localStorage` `saldesk-auth` with a fake activity-operator session.
- [ ] **Step 2: Check at 1280 px and 375 px.** Pages:
  - dashboard Hoje and Resumo;
  - Reservas, Calendário, Unidades, Clientes, Financeiro, Definições;
  - one open modal, one row menu and one toast;
  - the login screen.

  For each, confirm:
  - no console errors;
  - no horizontal page scroll (`document.documentElement.scrollWidth <= innerWidth`);
  - buttons, tabs, chips, fields and badges show the new look;
  - nothing is cut or overlapping.

  Also open one portal (the beach seller `/vendedor`, or the staff portal) and confirm it looks as before.
- [ ] **Step 3: Fix or record.**
  - One-line layout fixes go in, with a test where testable; then run the full suite and `npm run build`.
  - Everything else is listed in the report under "for the area phases".
- [ ] **Step 4: Commit any fixes.** Message: `fix: acertos de layout encontrados na verificacao no navegador`. Share screenshots with the owner.
