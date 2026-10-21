# Hidden Keywords Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in "Add hidden keywords" checkbox to the Tailor drawer. When on, the AI rewrite also picks grounded O\*NET terms, and the PDF renders them as white 1pt text that takes no layout space.

**Architecture:** A new `hiddenKeywords` field on `ResumeData`, plus small pure helpers in `web/src/lib/hidden-keywords.ts`. The tailor route gains a `keywords` flag. When the flag is set, the prompt lists O\*NET terms, the schema gains a `keyword` kind, and the server allowlist keeps only exact O\*NET names. The client strips keywords before sending, applies `keyword` edits locally, and the Typst generator places the block with `#place`.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TypeScript, Vitest, typst.ts, OpenAI Responses API.

**Spec:** `docs/superpowers/specs/2026-10-21-hidden-keywords-design.md`

## Global Constraints

- All commands run from `web/`. Use npm, not bun.
- Commit messages: exactly one line, Conventional Commits, no body, no footer, no `Co-Authored-By`.
- `MAX_HIDDEN_KEYWORDS = 30`; each keyword at most 80 characters (`MAX_SKILL_CHARS`).
- Default `hiddenKeywords` is `{ enabled: false, keywords: [] }`.
- Keyword dedupe is case-insensitive and trims whitespace.
- With the checkbox off, the `/api/onet/tailor` request body, prompt, and OpenAI schema are identical to today's.
- `hiddenKeywords` is never sent to the server.
- No new template helper; `REQUIRED_HELPERS` in `template-store.ts` is unchanged.
- Hidden keywords never appear in `serializeResumeText` output.
- Follow `AGENTS.md`: tabs, Prettier, Svelte 5 conventions, accessible labelled controls.

## Review Focus

1. Saved data or a v1 backup from before this change (no `hiddenKeywords` key) must load without error. Pinned in Task 1.
2. A keyword containing Typst-special characters (`#`, `*`, `[`, `]`, `\`, `$`, `@`, `<`) must render as literal text and compile. Pinned in Task 2.
3. A one-page resume plus 30 long keywords must still compile to exactly 1 page. Pinned in Task 2.
4. Editing hidden keywords while a rewrite is in flight must not mark the rewrite stale. Pinned in Task 4.
5. The model returning a near-miss term (different casing or extra whitespace) should be accepted and rewritten to O\*NET's exact casing. Invented terms are dropped. Pinned in Task 3.

---

### Task 1: Data model, normalization, storage, and backup

**Files:**
- Create: `web/src/lib/hidden-keywords.ts`, `web/src/lib/hidden-keywords.test.ts`
- Modify: `web/src/lib/types.ts` (`ResumeData`, `defaultResumeData`), `web/src/lib/store.ts` (`mergeWithDefaults`), `web/src/lib/resume-backup.ts` (`validateResume`)
- Test: `web/src/lib/store.test.ts`, `web/src/lib/resume-backup.test.ts`

**Interfaces:**
- Produces, in `types.ts`: `export interface HiddenKeywords { enabled: boolean; keywords: string[] }`; `ResumeData.hiddenKeywords: HiddenKeywords`; default `{ enabled: false, keywords: [] }`.
- Produces, in `hidden-keywords.ts`:
  - `export const MAX_HIDDEN_KEYWORDS = 30;`
  - `export const MAX_HIDDEN_KEYWORD_CHARS = 80;`
  - `export function addHiddenKeywords(existing: string[], additions: string[]): string[]`. Appends trimmed additions in order. Skips empty strings, entries over 80 chars, and case-insensitive duplicates of earlier entries. Stops at 30 total. Never reorders or drops existing entries.
  - `export function normalizeHiddenKeywords(value: unknown): HiddenKeywords`. Non-object becomes the default. `enabled` is `value.enabled === true`. `keywords` is `addHiddenKeywords([], <string entries of value.keywords>)`.
  - `export function withoutHiddenKeywords(data: ResumeData): Omit<ResumeData, 'hiddenKeywords'>`. Returns a copy without the key.

- [ ] **Step 1: Write failing tests**

`hidden-keywords.test.ts`:
- `addHiddenKeywords(['SQL'], [' sql ', 'Python', '', 'x'.repeat(81), 'python'])` equals `['SQL', 'Python']`.
- `addHiddenKeywords(Array.from({length: 29}, (_, i) => `k${i}`), ['a', 'b'])` has length 30 and ends with `'a'`.
- `normalizeHiddenKeywords(undefined)` and `normalizeHiddenKeywords('x')` equal `{ enabled: false, keywords: [] }`.
- `normalizeHiddenKeywords({ enabled: 'yes', keywords: ['A', 3, 'a', 'B'] })` equals `{ enabled: false, keywords: ['A', 'B'] }`.
- `'hiddenKeywords' in withoutHiddenKeywords(defaultResumeData)` is `false`.

`store.test.ts`: `mergeWithDefaults({})` has `hiddenKeywords` `{ enabled: false, keywords: [] }`. `mergeWithDefaults({ hiddenKeywords: { enabled: true, keywords: ['Go', 'go'] } } as never).hiddenKeywords` equals `{ enabled: true, keywords: ['Go'] }`.

`resume-backup.test.ts`:
- A backup built with `createBackup` whose `resume.hiddenKeywords` has been deleted parses, and the result has the default.
- A backup with `hiddenKeywords: { enabled: true, keywords: ['Splunk'] }` round-trips through `createBackup`/`parseBackup`.
- `hiddenKeywords: { enabled: 'no', keywords: [] }` throws `Invalid backup: resume.hiddenKeywords.enabled.`

- [ ] **Step 2: Run `npx vitest run src/lib/hidden-keywords.test.ts src/lib/store.test.ts src/lib/resume-backup.test.ts`. Expect FAIL.**

- [ ] **Step 3: Implement**

- Add the type and default to `types.ts`.
- Write `hidden-keywords.ts` as specified.
- In `mergeWithDefaults`, add `hiddenKeywords: normalizeHiddenKeywords(saved.hiddenKeywords)`.
- In `validateResume`, before `record(...)`, fill a missing key the way education fills `concentration`. If `value` is an object without `hiddenKeywords`, set it to `{ enabled: false, keywords: [] }`. Add `hiddenKeywords: shape({ enabled: boolean, keywords: arrayOf(string) })` to `fields`. Keep `BACKUP_VERSION = 1`.
- Fix any other `ResumeData` literals that `npm run check` flags, such as test fixtures and `withDocumentType`.

- [ ] **Step 4: Run the same vitest command, then `npm run check`. Expect PASS and 0 errors.**

- [ ] **Step 5: Commit** `feat(resume): add hidden keywords data model`

---

### Task 2: Typst rendering and plain-text exclusion

**Files:**
- Modify: `web/src/lib/typst-generator.ts` (`generateTypstCode`)
- Test: `web/src/lib/typst-generator.test.ts`, `web/src/lib/typst-generator.wasm.test.ts`, `web/src/lib/resume-text.test.ts`

**Interfaces:**
- Consumes: `ResumeData.hiddenKeywords` (Task 1).
- Produces: `function generateHiddenKeywords(hidden: HiddenKeywords): string`, module-private. Returns `''` when `!enabled` or the list is empty. Otherwise returns exactly:

```typst
#place(bottom + left, text(fill: white, size: 1pt)[<k1>, <k2>, ...])
```

  Each keyword goes through `typstMarkup`, and they are joined with `', '`.

- [ ] **Step 1: Write failing tests**

`typst-generator.test.ts`:
- With `enabled: false` and keywords `['Splunk']`, the output does not contain `fill: white, size: 1pt`.
- With `enabled: true` and keywords `[]`, the output does not contain it.
- With `enabled: true` and keywords `['Splunk', 'C#']`, the output contains `#place(bottom + left, text(fill: white, size: 1pt)[Splunk, ` followed by `typstMarkup('C#')` and `])`. The `#place` line comes after the last section heading.
- `generateTypstTemplate(dataWithKeywords)` does not contain `Splunk`, and `hasResumeContent` on default data plus enabled keywords is `true`.

`typst-generator.wasm.test.ts`:
- `defaultResumeData` with a name, plus 30 keywords like `'Security information and event management SIEM software #[*]$@<\\'`, compiles, and `pageCount` is `1`.

`resume-text.test.ts`:
- `serializeResumeText` of data with `enabled: true` and keywords `['UniqueKeywordZ']` does not contain `UniqueKeywordZ`.

- [ ] **Step 2: Run `npx vitest run src/lib/typst-generator.test.ts src/lib/resume-text.test.ts`. Expect FAIL on the generator tests. The resume-text test may already pass; keep it as a regression.**

- [ ] **Step 3: Implement** `generateHiddenKeywords`. Append it after `${orderedSections}` in `defaultCode`, separated by a blank line, so custom templates inherit it through the existing content splice. `withoutResumeContent` already resets to `defaultResumeData`, so it needs no change.

- [ ] **Step 4: Run `npx vitest run src/lib/typst-generator.test.ts src/lib/resume-text.test.ts src/lib/typst-generator.wasm.test.ts`. Expect PASS. The wasm suite needs network access for fonts.**

- [ ] **Step 5: Commit** `feat(typst): render hidden keywords as invisible block`

---

### Task 3: Server tailoring support

**Files:**
- Modify: `web/src/lib/onet-types.ts` (`TailorEdit`), `web/src/lib/server/tailor.ts`, `web/src/routes/api/onet/tailor/+server.ts`
- Test: `web/src/lib/server/tailor.test.ts`

**Interfaces:**
- Consumes: `MAX_HIDDEN_KEYWORDS` and `MAX_HIDDEN_KEYWORD_CHARS` from `$lib/hidden-keywords`, and `serializeResumeText` from `$lib/resume-text`.
- Produces:
  - `TailorEdit['kind']` gains `'keyword'`. Keyword edits use `targetId: 'keywords'` and `bulletIndex: -1`.
  - `export function tailorSchema(keywords: boolean)`. Same shape as today. The `kind` enum adds `'keyword'` only when `keywords` is `true`. `export const TAILOR_SCHEMA = tailorSchema(false);` stays for the existing tests.
  - `AllowedTargets` gains `keywords?: Map<string, string>` (lowercased term to O\*NET's exact term) and `visibleText?: string` (lowercased `serializeResumeText(resume)`).
  - `buildTailorInput(resume, occupation, compiledPageCount?, options: { keywords?: boolean } = {})`.
  - `export function occupationTerms(occupation: OnetOccupation): string[]`. Returns the unique names in this order: technology categories, technology example names, skill names, knowledge names. Uniqueness is case-insensitive.
  - `export const MAX_KEYWORD_EDITS = MAX_HIDDEN_KEYWORDS;`

- [ ] **Step 1: Write failing tests** in `tailor.test.ts`

- `buildTailorInput(resume, occupation).prompt` equals the same call with `{ keywords: false }`, and neither contains `HIDDEN KEYWORDS`. `allowed.keywords` is `undefined`.
- `tailorSchema(false)` deep-equals the current `TAILOR_SCHEMA` literal; snapshot today's enum in the test. `tailorSchema(true)`'s enum includes `'keyword'`.
- With `{ keywords: true }`, the prompt contains `=== HIDDEN KEYWORDS ===` and every value of `occupationTerms(occupation)`, and `allowed.keywords.get('splunk')` is `'Splunk'` for a fixture technology example `Splunk`.
- `validateEdits`, with `allowed.keywords` holding `splunk -> Splunk` and `allowed.visibleText` of `'python'`:
  - `{kind:'keyword', targetId:'keywords', text:' SPLUNK ', bulletIndex:-1}` becomes `{kind:'keyword', targetId:'keywords', text:'Splunk', bulletIndex:-1}`.
  - `text:'Kubernetes'` (not on the allowlist) is dropped.
  - A keyword whose term is `Python` is dropped, because it already appears in the visible text.
  - The same keyword twice is kept once.
  - A keyword edit when `allowed.keywords` is `undefined` is dropped.
  - `bulletIndex: 0` or `targetId: 'x'` is dropped.
  - 12 valid `add_bullet` edits plus 5 valid keyword edits are all kept, because the two caps are separate. More than 30 keyword edits are capped at 30.
- `isValidTailorResume` accepts `defaultResumeData` with and without `hiddenKeywords`.

- [ ] **Step 2: Run `npx vitest run src/lib/server/tailor.test.ts`. Expect FAIL.**

- [ ] **Step 3: Implement**

- When `options.keywords` is set, `buildTailorInput` appends this section at the end. Use this exact copy:

```text
=== HIDDEN KEYWORDS ===
Also return kind "keyword" edits: pick terms from the list below that the resume above already evidences (bullets, skills, project stacks, education). Copy each term exactly as listed. Never pick a term the resume does not support. targetId MUST be "keywords" and bulletIndex MUST be -1. Return at most 30.
Terms:
- <term>
```

  Set `allowed.keywords` from `occupationTerms`. Set `allowed.visibleText` to `serializeResumeText(resume).toLowerCase()`.
- In `validateEdits`, replace the single `out.length >= MAX_EDITS` break with separate per-kind counters. Use `continue` instead of `break` so later keyword edits still count. A `keyword` edit is kept only if all of these hold:
  - `allowed.keywords` is defined.
  - `targetId === 'keywords'`.
  - `bulletIndex === -1`.
  - The trimmed text is 80 characters or less.
  - The trimmed lowercase text is a key in the map.
  - The canonical term, lowercased, is not a substring of `visibleText`.

  Emit the canonical term. Dedupe it under the existing `seen` key.
- In the route, read `const keywords = body.keywords === true;`. Pass `{ keywords }` to `buildTailorInput`, and pass `tailorSchema(keywords)` as the schema. Leave `MAX_TAILOR_OUTPUT_TOKENS` (8,000) unchanged; 30 short terms fit.

- [ ] **Step 4: Run `npx vitest run src/lib/server/tailor.test.ts src/lib/server/api-routes.test.ts`, then `npm run check`. Expect PASS.**

- [ ] **Step 5: Commit** `feat(onet): add grounded hidden keyword edits to tailoring`

---

### Task 4: Applying edits, drawer UI, and docs

**Files:**
- Modify: `web/src/lib/onet-apply.ts` (`applyTailorEdits`), `web/src/lib/components/OnetDrawer.svelte`, `README.md`
- Test: `web/src/lib/onet-apply.test.ts`

**Interfaces:**
- Consumes: `addHiddenKeywords` and `withoutHiddenKeywords` (Task 1), and the `'keyword'` kind (Task 3).
- Produces: `applyTailorEdits(submitted: Omit<ResumeData, 'hiddenKeywords'>, current: ResumeData, edits: TailorEdit[])` returns `{ data; paths; removed; stale; keywordsAdded: number }`.

- [ ] **Step 1: Write failing tests** in `onet-apply.test.ts`

- Stale check: `submitted = withoutHiddenKeywords(r)`, and `current` is `r` with different `hiddenKeywords`. Then `stale` is `false`.
- Changing the profile summary in `current` still gives `stale: true`.
- Two keyword edits `'Splunk'` and `'Nessus'`, applied to current keywords `['splunk']`, give keywords `['splunk', 'Nessus']` and `keywordsAdded: 1`. `enabled` is unchanged, and `paths` gets no entry.
- Applying keywords when the list is already at 30 adds nothing and gives `keywordsAdded: 0`.

- [ ] **Step 2: Run `npx vitest run src/lib/onet-apply.test.ts`. Expect FAIL.**

- [ ] **Step 3: Implement `applyTailorEdits` changes**

- Compare `JSON.stringify(submitted)` to `JSON.stringify(withoutHiddenKeywords(current))`.
- Collect `keyword` edit texts and run them through `addHiddenKeywords` once. `keywordsAdded` is the length difference.

- [ ] **Step 4: Implement the drawer** (`OnetDrawer.svelte`, inside the "Let AI do it" section, above the button)

- A labelled checkbox, "Add hidden keywords", bound to `data.hiddenKeywords.enabled`. Assign a new object so the store persists.
- Help text, `text-xs`, using this exact copy:

  > Adds keywords your resume already supports in invisible text for applicant tracking systems. Some systems show recruiters the extracted text or flag hidden text.

- When enabled:
  - Show each keyword as a chip with a remove `<button>`, `aria-label="Remove keyword <k>"`.
  - Add a labelled text input; Enter adds through `addHiddenKeywords` and clears the input.
  - Show the count against the cap, for example `3 / 30`.
- In `autoTailor`:
  - `submitted` becomes `JSON.parse(JSON.stringify(withoutHiddenKeywords(data)))`.
  - The body becomes `{ resume: submitted, code, pageCount, ...(data.hiddenKeywords.enabled ? { keywords: true } : {}) }`.
- Add the tailor note line: when `keywordsAdded > 0`, add part `` `${n} hidden ${n === 1 ? 'keyword' : 'keywords'} added` ``. Count it toward `changes`.

- [ ] **Step 5: README.** Under features, add one bullet describing the checkbox, the grounding rule, and the ATS caveat. In the privacy and storage text, add that hidden keywords are stored in browser `localStorage` with the resume and are never sent to the server.

- [ ] **Step 6: Run `npx vitest run src/lib/onet-apply.test.ts`, then `npm test`, `npm run check`, `npm run lint`, and `npm run build`. Expect all to pass. If lint flags untouched files, run `npm run format` and commit only touched files.**

- [ ] **Step 7: Manual check.** Run `npm run dev`. Pick an occupation, tick the box, add `Test Keyword` by hand, and confirm:
  - The PDF preview looks unchanged.
  - The page count is unchanged.
  - Copying text from the downloaded PDF includes `Test Keyword`.
  - "Copy as plain text" does not include it.

- [ ] **Step 8: Commit** `feat(onet): add hidden keywords checkbox to tailor drawer`
