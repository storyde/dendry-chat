# ES6 Transition Plan For Dendry Browser UI

## Goal

Convert `lib/ui/browser.js` into a modern, jQuery-free, ES6+ source file and produce a modern `out/html/core.js` for evergreen browsers.

This document is the implementation plan only. It does **not** make code changes yet.

## Decision

### Drop Babel?

Yes. For this repo and this target, I would **drop Babel** from the plan.

### Preferred build direction

Use **Bun as the target bundler/minifier for `make-html`** and keep Browserify only as a temporary fallback during migration if Bun exposes an unexpected compatibility edge.

### Why this is the right call here

1. The project already builds with Bun.
2. The desired output does not need legacy browser support.
3. Babel would mainly add ES5-era transpilation and config overhead, which works against the goal of shipping a modern `core.js`.
4. The current UI problem is not syntax support. The real risk is preserving:
   - dynamic `this`
   - `window`-visible hooks
   - current bootstrap behavior
   - engine/runtime integration
5. Browserify + Uglify reflects the old toolchain, but it is not the source of the jQuery coupling. The missing piece is the safe modernization of `lib/ui/browser.js`.

## Scope

In scope:

- `lib/ui/browser.js`
- `lib/ui/browser_reference.js` as reference only
- `lib/ui/content/html.js`
- `lib/engine.js`
- `lib/cli/cmd/make-html.js`
- the generated `out/html/core.js`

Out of scope:

- jQuery cleanup in `P:\Documents\GitHub\managecomplexity-7\out\`
- broader engine redesign
- story/runtime `$code` modernization
- HTML template redesign beyond what is needed for bundling/bootstrap compatibility

## Core Constraints

These are the rules the implementation must follow.

1. Keep `window.game.compiled` as the bootstrap source unless we explicitly redesign the HTML startup contract.
2. Keep `window.dendryUI`.
3. Preserve the hook surface used today:
   - `window.dendryModifyUI`
   - `window.onDisplayContent`
   - `window.onNewPage`
   - `window.handleSignal`
   - `window.setSprites`
   - `window.setSprite`
   - `window.setSpriteStyle`
   - `window.displayText`
   - `window.displayParagraphHTML`
4. Preserve engine behavior based on dynamic execution from `lib/engine.js`:
   - `new Function('state', 'Q', source)`
   - `.call(context, state, state.qualities)`
5. Do not switch the shipped HTML to native module loading as part of this pass. The template currently loads `core.js` as a normal script.
6. Keep behavior changes separated from syntax/style modernization wherever possible.

## Important Technical Finding

`browser_reference.js` is useful as a **pattern source** for native DOM replacements, but it is **not** a drop-in solution.

Reasons:

1. It keeps at least one known logic bug from `browser.js` (`setSprites` object handling).
2. It changes some interaction details and callback structure.
3. It does not by itself prove that all `this` semantics were preserved correctly.

So the migration should use it as a guide, not as the final truth.

## High-Risk `this` And Runtime Hotspots

These are the spots the implementation must review carefully.

### Engine dynamic execution

In `lib/engine.js`:

- `new Function('state', 'Q', source)`
- `fn.call(context, state, state.qualities)`
- predicate/expression `.call(...)`

Meaning:

- Dendry story code depends on runtime call context.
- We must not assume lexical `this` is safe in engine-facing execution paths.

### Prototype methods in `browser.js`

All `BrowserUserInterface.prototype.*` methods are instance methods and should remain methods, not arrow properties.

Safe targets:

- convert constructor/prototype to `class` methods only after the compatibility surface is stable
- use arrow functions only inside callbacks where lexical capture is intended

Unsafe targets:

- turning engine-facing methods into arrows
- blindly replacing every callback with arrows without checking whether jQuery or DOM APIs supplied a meaningful `this`

### jQuery event delegation in `_registerEvents`

Current code relies on jQuery delegated events for:

- choice link clicks
- choice list item clicks

When converting to native DOM events:

- use `event.target`, `closest(...)`, and `currentTarget` deliberately
- do not rely on function `this` matching jQuery behavior

### jQuery animation callbacks

Several methods use callbacks inside fade/animate operations:

- `newPage`
- `setBg`
- `setSprites`
- `setSprite`
- `audio`

These are exactly the places where accidental `this` breakage happens during ES6 conversion.

Special note:

- `setSprite` currently contains a known `this` bug in the fade callback pattern
- the plan should treat callback context cleanup as part of the migration, not as an afterthought

### Window hook visibility

If we move to `const`/`let` and module-local helpers, those bindings will **not** automatically appear on `window`.

That means any hook expected by story code, content rendering, or external game scripts must be attached explicitly.

## Target Architecture

### Source level

`lib/ui/browser.js` becomes:

- jQuery-free
- ES6+ source
- internally modular/cleaner
- still compatible with the engine/bootstrap contract

### Runtime level

The browser bundle remains a normal browser script that:

1. reads `window.game.compiled`
2. constructs the UI
3. exposes `window.dendryUI`
4. preserves all existing optional hooks

### Build level

`make-html` moves from:

- Browserify + Uglify

to:

- Bun-driven browser bundling/minification

with the output staying as a standard script bundle, not a module-script migration.

## Phased Plan

## Phase 00 -  Obvious Bug Fixes

Bug Fix 1 — Typo: 'bacground-color' → 'background-color' (line 208)
Effect: Solid-color backgrounds (hex/rgb/rgba) were silently failing when background animations were disabled. Now the CSS property name is correct.

Bug Fix 2 — Broken setSprites object-mode iteration (lines 258-262)
Was: for (var key in Object.keys(data)) — this iterates the numeric indices of the Object.keys() array (0, 1, 2…), not the actual key names. Plus sprites was never declared → ReferenceError. Now: Uses Object.keys(data) properly into a named array, iterates indices to extract each key, then calls this.setSprite(objKey, data[objKey]) consistently with the Array branch.

Bug Fix 3 — Typo: targetSprite.emtpy() → targetSprite.empty() (line 293)
Effect: Sprite container was never cleared when re-rendering with a new image, so the old image would still sit in the DOM under the new one. Also fixed a separate pre-existing this-capture bug: this.fade_time would resolve to undefined inside the jQuery fadeOut callback (since it's a normal function with its own this). Now captured into a local fadeTime variable before the callback.

Bug Fix 4 — Missing createExportListener function (between lines 574-579)
Effect: The Export button click handler (populateSaveSlots line 597) called createExportListener(id) which didn't exist → ReferenceError + export buttons were non-functional. Now added symmetrically alongside the existing createLoadListener, createSaveListener, and createDeleteListener helpers, invoking that.exportSlot(i).

Bug Fix 5 — Missing error handling in importSave (lines 545-559)
Was: Crashed with uncaught errors if: no file selected, FileReader failed to read, or save data contained invalid JSON.
Now: Guards against missing uploader/files[0], adds reader.onerror handler, and wraps JSON.parse + setState in a try/catch with user-facing error alerts.


## Phase 0 - Freeze The Contract

Goal: define what must not break before any rewrite.

Tasks:

1. Record all `window.*` hooks used by:
   - `lib/ui/browser.js`
   - `lib/ui/content/html.js`
2. Record startup/bootstrap expectations:
   - `window.game.compiled`
   - `window.dendryUI`
   - `DOMContentLoaded` startup timing
3. Record required DOM IDs:
   - `#content`
   - `#bg1`
   - `#bg2`
   - sprite containers
   - save/options modal IDs
4. Record the behavior checklist for:
   - startup
   - content rendering
   - choices
   - page transitions
   - background changes
   - sprite updates
   - audio
   - save/load/import/export
   - custom hooks

Done when:

- we have a written compatibility checklist for the current UI contract

## Phase 1 - Separate DOM Migration From ES6 Cleanup

Goal: migrate away from jQuery without mixing in unnecessary structural churn.

Tasks:

1. Use `browser_reference.js` to identify native replacements for:
   - element creation
   - querying
   - class changes
   - style updates
   - event delegation
   - fade/animate behavior
2. Port those replacements into `browser.js` carefully, function by function.
3. Keep bootstrap and engine-facing behavior unchanged.
4. Fix already-known jQuery-era defects when they are touched, but do not broaden scope.

Guardrails:

- do not convert everything to classes/modules in the same pass
- do not change public hook names
- do not change save system behavior unless fixing an identified defect

Done when:

- `browser.js` is jQuery-free and behaviorally equivalent enough to replace the old file

## Phase 2 - ES6 Source Modernization

Goal: make the source clean and modern after jQuery is gone.

Allowed changes:

- `var` -> `const` / `let`
- template literals
- destructuring
- helper extraction
- `class BrowserUserInterface` if method semantics remain intact
- arrow functions only where lexical `this` is intended

Required review checklist for each edited function:

1. Is this function called as an instance method?
2. Does this callback depend on dynamic `this`?
3. Was jQuery previously supplying a different callback context?
4. Does this symbol need to stay on `window`?

Done when:

- the source reads like modern JavaScript without changing the runtime contract

## Phase 3 - Compatibility Bridge

Goal: make global exposure explicit instead of accidental.

Tasks:

1. Centralize all `window` exposure in one place.
2. Explicitly attach:
   - `window.dendryUI`
   - any externally callable hook wrappers that must remain global
3. Keep content-renderer hooks working:
   - `window.displayText`
   - `window.displayParagraphHTML`
4. Keep optional UI extension hooks working:
   - `window.dendryModifyUI`
   - `window.onDisplayContent`
   - `window.onNewPage`
   - `window.handleSignal`
   - sprite hook functions

Done when:

- the code no longer relies on accidental globals
- the remaining globals are deliberate and documented

## Phase 4 - Bun Build Migration

Goal: generate a modern `core.js` without Babel.

Tasks:

1. Replace the Browserify bundling step in `lib/cli/cmd/make-html.js`.
2. Replace Uglify with Bun-native minification for browser output.
3. Keep the final code assembly equivalent in purpose:
   - embed `window.game = { compiled: ... }`
   - append the UI bundle
4. Keep the output as a plain browser script compatible with the current template include.

Important implementation note:

- this phase should change the build tool, not the browser bootstrap contract

Done when:

- `bun ./lib/cli/main.js make-html` produces a working modern `out/html/core.js`

## Phase 5 - Verification Against The Real Output

Goal: verify that the generated file is modern for the right reasons.

Checks:

1. `out/html/core.js` should no longer contain jQuery usage from `browser.js`.
2. The output should preserve bootstrap globals required by the current HTML/runtime.
3. The output should not be downleveled to legacy-browser ES5 just to satisfy Babel-era tooling.
4. Runtime smoke test should pass for:
   - initial page load
   - first scene render
   - choice click
   - page transition
   - at least one save/load cycle
   - at least one sprite/background update

Done when:

- the modern output is functionally correct and contract-compatible

## Specific Implementation Notes For `browser.js`

### Treat these methods as highest review priority

- `displayContent`
- `displayChoices`
- `newPage`
- `endOutput`
- `setBg`
- `setSprites`
- `setSprite`
- `audio`
- `populateSaveSlots`
- `_registerEvents`
- `main`

### Known issues to preserve awareness of during migration

1. `setSprites` object-mode handling is broken in both the legacy file and the reference file.
2. `setSprite` has callback-context fragility and a typo bug history.
3. Save-slot helper wiring and import/export behavior are easy to regress because they mix DOM lookup, state restore, and callback factories.
4. `audio` mixes queueing, loop state, fade timing, and current-instance mutation, which makes careless callback conversion dangerous.

### Modernization rule for arrows

Use arrows for:

- small internal callbacks where lexical capture is the point

Do not use arrows for:

- exported/global hook functions unless clearly safe
- instance methods that are part of the UI contract
- anything that may later be rebound or called with `.call(...)`

## Definition Of Done

The plan is complete when implementation delivers all of the following:

1. `lib/ui/browser.js` is jQuery-free.
2. `lib/ui/browser.js` is modern ES6+ source.
3. `out/html/core.js` is generated through Bun, without Babel.
4. The current non-module HTML bootstrap still works.
5. All current `window` hooks still work.
6. Engine/runtime dynamic `this` behavior is preserved.
7. The generated output targets evergreen browsers, not legacy ones.

## Final Recommendation

For this project, I would **not** add Babel.

I would implement the migration as:

1. preserve the current runtime contract
2. modernize `lib/ui/browser.js` carefully, using `browser_reference.js` only as a reference
3. make `window` exposure explicit
4. move `make-html` to Bun bundling/minification
5. verify the generated `core.js` directly

That gives the best path to the actual goal: a modern Dendry browser UI and a modern `core.js`, without carrying legacy-browser tooling forward.
