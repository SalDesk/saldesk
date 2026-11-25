# Task 2 report: Button, Input, Toggle, Tabs, FilterChips (Mare)

Implemented (looks only, all behind `app:`; base classes untouched so outside the app the old classes stay):
- Button: sm app:h-9, md app:h-11, lg app:h-12, all app:rounded-full (replaces app:rounded-[6px]); new `confirm` variant (ocean-900/white/hover ocean-800); secondary white + ocean-200 border + ocean-700 text, hover border ocean-500; ghost ocean-700 text, hover ocean-50; ring app:focus-visible:ring-sand-500. danger/accent unchanged.
- Input/Textarea/Select: app:h-11 (Input/Select), app:rounded-xl, app:border-mare-field (error keeps border-error via app:border-error so the override cannot hide it), app:focus:ring-sand-500, label app:font-semibold, error hint app:text-[13px]. aria/label wiring unchanged.
- Toggle: on = app:bg-turquoise-600; 44px hit area via app:before pseudo-element (inset-x-0.5, inset-y-3); added focus ring.
- Tabs: app track white rounded-full, border mare-card, p-1, w-fit max-w-full, keeps overflow-x-auto; pills app:min-h-10 rounded-full, active ocean-900/white, inactive ocean-700 hover ocean-50; underline removed in app (app:border-b-0); 44px hit area via before pseudo-element; count badge adapts on active.
- FilterChips: app:h-9 pills, active ocean-900, inactive border mare-field, ocean-700 text.

Verification: build CSS contains all new app: utilities (checked app:h-11, before:-inset-y-3, bg-turquoise-600, ring-sand-500, border-mare-card, rounded-full, min-h-10, rounded-xl, hover:border-ocean-500). Override pattern same as existing app:bg-sand-500 (variant selector :is([data-ui=app],[data-ui=app] *) raises specificity); no `!` modifier used. Where hover base utilities have equal specificity (Tabs text hover) I added explicit app:hover: classes.
Tests: `npx vitest run ui uiAcessibilidade` 195/195 (6 files incl. Guides). Full suite: 161 files / 3794 tests passing. `npm run build` OK. No existing test needed changing.

TDD note: tests were written after the implementation in this run (no RED captured).
Files: frontend/src/components/ui/{Button,Input,Toggle,Tabs,FilterChips}.jsx; frontend/src/__tests__/{ui,uiAcessibilidade}.test.jsx.
Concerns: lg size h-12 and md app px/semibold are my choice (brief said "sizes above": md 44, sm 36, lg >=44). Input text in app went 13px -> 14px (proposal .inp). Tab pill hit area relies on pseudo-element inside the overflow track (fits within p-1 padding).

## Fix round 1
- Input/Textarea/Select radius: app:rounded-xl (24 px here) -> app:rounded-md (12 px); test updated.
- Toggle: new focus classes now all app:-scoped (app:focus-visible:outline-none/ring-2/ring-sand-500); outside the app the list is today's.
- New tests in ui.test.jsx ("Fora da app..."): frozen pre-change token lists (non-app: tokens, sorted, toEqual) for Button (6 variants x 3 sizes), Input/Textarea/Select (normal + error, label, error hint), Toggle on/off, Tabs (track, tabs, counters), FilterChips. RED: Toggle test failed with the leak present (expected tokens differ), other tests passed; GREEN after fix.
- Commands: `npx vitest run ui uiAcessibilidade` -> 6 files, 200 passed; full suite and build: see commit message result below.
