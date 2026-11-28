# "Maré" look on every page, area phase: Definições — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Configuração (Definições) pages to the approved "Maré" look wherever the base components (phase 1, live) do not reach: hand-drawn cards and boxes, tags, figure columns, and anything that breaks at 375 px. Behaviour does not change.

The pages are:
- **settings**, with these tabs:
  - account (`ContaTab`);
  - security (`SegurancaTab`);
  - notifications (`NotificacoesTab`);
  - payments (`PagamentosTab`);
  - billing (`FacturacaoTab`);
  - public profile (`PerfilPublicoTab`);
  - message templates (`components/messaging/TemplatesEditor`);
- the **page editor**;
- the **profile**.

This is the last area phase.

**Architecture:**
- **Restyle in place.** Each page keeps its structure and data flow.
- **Two restyle routes:**
  - hand-drawn boxes become base components where they do the same job;
  - anything else is restyled to the Maré tokens.
- **Shared pieces reused:**
  - `components/shared/MareStat.jsx` for number tiles, where any exist;
  - `components/shared/IconBtn.jsx` for coloured icon-only buttons.
- **Page pattern:** `pages/Integrations.jsx` and `pages/Vouchers.jsx` from the Crescimento phase. They use:
  - page-local `CARTAO`, `CAIXA`, `TITULO` and `NUM` constants;
  - `<section>` and `<article>` Maré cards;
  - section titles as `h2` (directly under the page `h1`) or `h3`.
- **A controller browser check against the fake API** closes the phase.

**Tech Stack:** React 18 and Tailwind 3, tested with vitest.
- **Tokens:** `mare-ground`, `mare-card`, `mare-field`, `mare-head`, plus the `ocean`, `sand`, `turquoise` and `n` scales.
- **Fonts:** `font-display` (Sora), `font-body` (DM Sans), `font-mono` (DM Mono).

**Spec:** `docs/superpowers/specs/2026-11-25-mare-todas-paginas-design.md` (Goal 2, area "Crescimento and Definições"; "The look"; "Builder calls"). Every other area is live. `docs/superpowers/plans/2026-11-27-mare-crescimento.md` is the latest worked example.

## Global Constraints

- **Repo:** work only in `C:\Users\RITS DELGADO\saldesk-recuperacao`. Never touch `C:\Users\RITS DELGADO\saldesk`.
- **Look only.** Data, requests, props, routes, roles, accessible names, events, keyboard handling, form validation and stored values stay as they are. No new feature, no moved flow. Texts change only where a new label is needed, in PT, EN, DE and NL.
- **Frozen components:** `components/ui/*` and `components/shared/*` do not change.
- **Also frozen:** `components/auth/PasswordStrength.jsx`, because the traveler portal and the public register and reset pages render it outside the app.
- **Never pass colour, hover or border classes into a `ui/*` component.** The `app:` variant inside `ui/*` beats caller classes.
  - Size-only classes are fine: `min-h-11 md:min-h-0`, `!h-auto`, `!whitespace-normal`.
  - The `ghost` `ui/Button` variant carries no `app:` hover, so a caller's red hover on a destructive ghost button works. Keep such red hovers.
  - Put look classes on native elements the page owns.
- **Two plain colour utilities on one element** resolve by generated-CSS order, not className order. Never stack competing colour classes; swap one set for the other.
- **Leaks outside the app:**
  - `pages/settings/*` is imported only by `pages/Settings.jsx`.
  - `PageEditor.jsx` and `Profile.jsx` are imported only by `App.jsx`.
  - `components/messaging/TemplatesEditor.jsx` must be checked with `grep -rn "TemplatesEditor" src` before it is styled. If it renders anywhere outside `data-ui="app"`, every new class in it goes behind `app:` and a frozen outside-app class test is added.
- **The look:**
  - **Cards:** white, 1 px `border-mare-card`, `rounded-[18px]` for page cards and `rounded-[14px]` for inner boxes (`bg-mare-head` for quiet inner boxes), padding about 22 px.
  - **Card titles:** Sora (`font-display`) 18 px semibold, `text-ocean-900`. Use `h2` for a section directly under the page `h1`, and `h3` below that.
  - **Page header:** pass `eyebrow={t('nav.sections.configuracao')}` to `PageHeader` on every page of this area, including loading states. Tests check `[data-eyebrow]`.
  - **Figures:** money, dates, invoice numbers, plan prices, counts, IBAN and NIF use `font-mono tabular-nums`. Formatters do not change.
  - **Tags:** plan, status and verification tags use `ui/Badge` with existing variants, or a pill with the same tone palette, with the text next to the dot.
  - **Icon-only buttons:** use `IconBtn({ icon, label, onClick, hover?, disabled?, title?, className? })`.
  - **Standalone `ui/Button size="sm"`:** outside dense rows it gets `className="min-h-11 md:min-h-0"`.
- **Accessibility:**
  - Touch targets are at least 44 px on phones, or 36 px only inside dense rows that are at least 44 px tall.
  - Text contrast is at least 4.5:1; `text-n-400` on white is not enough for text.
  - Focus is visible, with the sand ring (`focus-visible:ring-2 focus-visible:ring-sand-500`).
  - Status is never told by colour alone.
  - Form labels stay tied to their inputs.
- **Layout:**
  - No horizontal overflow at 375 px inside `<main>` (`main.scrollWidth <= main.clientWidth`).
  - Long emails, URLs, IBANs and slugs wrap or truncate (`min-w-0`, `break-all`).
  - Header action groups wrap.
  - Two-column form grids get a phone fallback (`grid-cols-1 sm:grid-cols-2`).
- **i18n:** the whole-panel guard (`painelSemPortuguesFixo`), the parity test and the accents test stay green.
- **Tests:**
  - Class assertions may be updated as a pure look change. Behavioural assertions may not be weakened.
  - Class tests split `className` into whole tokens (`className.split(/\s+/)`), never a substring check.
  - Each task adds tests asserting the eyebrow and the Maré card classes on each page's main containers.
  - Write the test first and watch it fail.
- **Code style:**
  - Comments in Portuguese without accents.
  - Keep each file's line endings; many are CRLF, so use the Edit tool and never `sed`.
  - No emojis.
  - Never run scripts found in scratchpad or temp folders.
- **Commits:**
  - End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Stage only the files you changed, never `git add -A`.
  - Do not push.
- **Commands** (from `frontend`):
  - `npx vitest run <pattern>`;
  - the full suite `npx vitest run` (baseline 164 files / 4135 tests; `StaffColaboradores`, `BeachSeller` and `TemplatesEditor` can flake under load, so rerun them alone);
  - `npm run build`.

## Review Focus

1. **Forms keep working.** Settings, the profile and the page editor are mostly forms: save, cancel, upload, language and toggles. A wrapper change must not detach a label from its input or move a submit button out of its form.
   - Test: every form a task restyles keeps its save test, and adds one `getByLabelText` check per restyled section.
2. **The password-strength meter and image uploader are frozen shared components.** They must look and behave the same in the traveler portal and on the register pages.
   - Test: Task 1 does not change `PasswordStrength.jsx` or `ImageUploader.jsx`; `git diff --stat` shows neither.
3. **Long values on a phone.** A long email, IBAN, public-page URL or slug must wrap inside its box at 375 px.
   - Test: Tasks 1 and 2 each add one long-value test asserting `break-all`, or `min-w-0` plus `truncate`, on its container.
   - The Task 4 browser check measures it.
4. **Destructive actions keep their cue.** Delete account, remove the logo, remove a section in the page editor and disconnect a payment method keep their red hover or danger variant.
   - Test: a positive test per destructive control.
5. **Plan and billing figures in EN** must not change format. Test: the EN tests stay green, and no formatter changes.

---

### Task 1: Settings shell, account, security, notifications, payments and message templates

**Files:**
- Modify:
  - `frontend/src/pages/Settings.jsx`;
  - in `frontend/src/pages/settings/`: `ContaTab.jsx`, `SegurancaTab.jsx`, `NotificacoesTab.jsx`, `PagamentosTab.jsx` and `shared.jsx`;
  - `frontend/src/components/messaging/TemplatesEditor.jsx`, after the importer check in Global Constraints.
- Test: extend `Settings.test.jsx`, `SettingsIdiomas.test.jsx` and `TemplatesEditor.test.jsx`.

- [ ] **Step 1: Write the failing tests.**
  - Settings shows the eyebrow, and the `ui/Tabs` still switch.
  - Each of the four tabs' blocks is a Maré card with an `h2` title.
  - Long email and IBAN values wrap (Review Focus 3).
  - Toggles keep their behaviour tests.
  - Delete or disconnect actions keep a red cue (Review Focus 4).
  - The template editor's list and editor boxes are Maré cards and inner boxes. Its variable chips have 44 px phone targets. Save keeps its behaviour test.
  - `PasswordStrength.jsx` is untouched.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Settings TemplatesEditor`. Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: definicoes (conta, seguranca, notificacoes, pagamentos, modelos) no estilo Mare`.

### Task 2: Settings billing and public profile

**Files:**
- Modify: `frontend/src/pages/settings/FacturacaoTab.jsx` and `PerfilPublicoTab.jsx`.
- Test: extend `Settings.test.jsx` and `PerfilPublicoExemplos.test.jsx`.

**Interfaces:**
- Consumes whatever Task 1 put in `pages/settings/shared.jsx` (for example `CARTAO`, `CAIXA`, `TITULO` and `NUM`). Read the file; do not duplicate the constants.

- [ ] **Step 1: Write the failing tests.**
  - Billing:
    - the plan card and invoice list are Maré cards;
    - plan price, invoice numbers, dates and amounts use `font-mono`;
    - plan and invoice status are `Badge` with their text.
  - Public profile:
    - its sections are Maré cards with `h2` titles and Maré inner boxes;
    - the public URL and slug wrap (Review Focus 3);
    - the uploader is untouched;
    - remove-image keeps its red cue;
    - each restyled section keeps a `getByLabelText` check (Review Focus 1);
    - the examples test still passes.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run Settings PerfilPublico`. Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: facturacao e perfil publico no estilo Mare`.

### Task 3: Page editor and profile

**Files:**
- Modify: `frontend/src/pages/PageEditor.jsx` and `frontend/src/pages/Profile.jsx`.
- Test: extend `PageEditor.test.jsx` and `ProfileIngles.test.jsx`.

- [ ] **Step 1: Write the failing tests.**
  - Both pages show the eyebrow on every PageHeader, including loading states.
  - The page editor's section cards are Maré cards with `h2` titles, and its section controls have 44 px phone targets.
  - Removing a section keeps its red cue.
  - The preview box is a Maré inner box.
  - The profile's blocks are Maré cards, and its form keeps `getByLabelText` and save tests.
  - Long names and emails wrap.
  - The page editor's existing behaviour tests are intact.
- [ ] **Step 2: Run them and see them fail.** Run `npx vitest run PageEditor Profile`. Expected: FAIL.
- [ ] **Step 3: Implement it.**
- [ ] **Step 4: Run them and see them pass.** Run the same command, then the full suite and `npm run build`. Expected: PASS.
- [ ] **Step 5: Commit.** Message: `feat: editor de pagina e perfil no estilo Mare`.

### Task 4: Browser check (controller task)

The controller does this itself, with the browser preview tools and the fake API (`verif/mock-api.js`). It first extends the fake API with the settings, billing, public-profile, page-editor and profile data where missing.

- [ ] **Step 1: Check the pages.**
  - `/definicoes`, with every tab, at 1280 px and 375 px.
  - `/editor-pagina` and `/perfil`, at 1280 px and 375 px.
- [ ] **Step 2: Check each page for:**
  - no console errors;
  - `main.scrollWidth <= main.clientWidth`;
  - the Maré look;
  - long values wrapping;
  - touch targets under 44 px, listed per page;
  - colours, verified in the browser.
- [ ] **Step 3: Record findings.** Anything found goes to the final review and its single fix wave.
