# Hidden Keywords Design

Issue: #84, "[Feature]: Whitespace Keyword Section"

## Intent

ATS software scores resumes on keyword matches. A resume often shows a skill in its own words ("built Splunk dashboards for alert triage") while the ATS looks for the standard term ("Security information and event management SIEM software"). This feature adds an opt-in block of standard O\*NET keywords, rendered in white at a tiny size, so ATS text extraction picks them up while a person reading the PDF does not see them.

The keywords must be backed up by something already on the resume. The block restates real experience in the vocabulary an ATS expects; it never adds skills the candidate lacks. This keeps it consistent with the tailor's first grounding rule.

## Goals

- One checkbox, "Add hidden keywords", in the Tailor drawer. The user decides.
- When checked, "Rewrite my resume" also returns grounded O\*NET keywords, and the PDF renders them as an invisible block.
- The user can see, remove, and add keywords by hand.
- Works with the built-in template and every existing custom template without changes to them.
- Never pushes a one-page resume onto a second page.

## Non-goals

- Pasting a specific job description. Keywords come only from the selected O\*NET occupation.
- A separate AI request or endpoint for keywords.
- Generating keywords without the AI (for example, a raw O\*NET dump).

## Anti-goals (failure even if it works)

- Keywords for skills the resume does not evidence.
- The feature on by default, or any keyword request sent when the checkbox is off.
- Old backups or saved resumes failing to load.
- Any change to the visible resume layout or page count caused by the block.

## Decisions made

- **Source:** the O\*NET occupation selected in the Tailor drawer (decided by the user).
- **Grounding:** only keywords the resume backs up (decided by the user).
- **Control:** a single checkbox in the Tailor drawer, next to "Rewrite my resume" (decided by the user). Unchecked means no keyword request and no rendered block. Checked means both.
- **Visibility:** white text, tiny font, not meant for recruiters (decided by the user).

## Design

### Data

Add to `ResumeData` in `web/src/lib/types.ts`:

```ts
hiddenKeywords: { enabled: boolean; keywords: string[] };
```

Default `{ enabled: false, keywords: [] }`.

- `store.ts` `mergeWithDefaults`: older saved data without the field gets the default; normalize to drop non-strings, trim, dedupe case-insensitively, and cap at `MAX_HIDDEN_KEYWORDS`.
- `resume-backup.ts`: the `record` validator requires an exact key count. Backups written before this change have no `hiddenKeywords` key and must still import (fill the default). New backups include it and validate its shape. Keep `BACKUP_VERSION = 1` unless the existing code makes a version bump the simpler path (builder's call).
- `withoutResumeContent` in `typst-generator.ts` must drop keywords (they are resume content), so `hasResumeContent` and template download stay correct.
- `server/tailor.ts` `isValidTailorResume` must accept the field when present and not reject resumes that omit it.

Limits (my call): `MAX_HIDDEN_KEYWORDS = 30`, each keyword at most `MAX_SKILL_CHARS` (80) characters.

### AI tailoring

- The drawer sends `keywords: true` in the `/api/onet/tailor` body only when the checkbox is on.
- The drawer always strips `hiddenKeywords` from the resume it submits, checked or not (my call). Hidden keywords never leave the browser, and the request with the box off is identical to today's. The stale check in `applyTailorEdits` must compare the stripped forms (or ignore `hiddenKeywords`) so editing keywords during a rewrite does not mark it stale.
- `TAILOR_SCHEMA` is built from the flag (my call): the `keyword` kind is in the `kind` enum only when keywords were requested, so the OpenAI request with the box off is unchanged. `TailorEdit['kind']` gains `keyword`. `targetId` is `"keywords"`, `bulletIndex` is `-1`.
- When on, `buildTailorInput` appends a section listing every O\*NET term from the fetched occupation (technology example names, technology categories, skill names, knowledge names) and tells the model to pick only terms the resume already evidences (bullets, skills, stack, education). It picks from the list; it does not write free text.
- Grounding is enforced on the server too (my call): `buildTailorInput` returns the term list as a case-insensitive allowlist in `AllowedTargets`, and `validateEdits` drops any keyword that is not an exact match. Invented terms can't get through. Whether a matched term is truly backed by the resume is still the model's judgment.
- Hidden keywords are never evidence for regular edits. They aren't in the prompt at all (see stripping above), so the model cannot write visible bullets from them.
- `MAX_EDITS` (12) stays for regular edits. Keyword edits get their own cap of `MAX_HIDDEN_KEYWORDS` so they do not crowd out rewrites (my call). `max_output_tokens` may need a small bump; check `MAX_TAILOR_OUTPUT_TOKENS` against the larger response.
- `validateEdits` drops a keyword edit when: keywords were not requested, it is not on the allowlist, text is empty or over 80 chars, it is a duplicate within the response, or it already appears word for word in the visible resume text. Dedupe against the existing hidden list happens client-side when applying.

### Applying edits

`applyTailorEdits` in `onet-apply.ts` appends `keyword` edits to `hiddenKeywords.keywords` with case-insensitive dedupe, up to the cap. Re-running a rewrite adds to the list; it does not replace hand-curated keywords (my call). The tailor note reports the count, for example "8 hidden keywords added".

### Drawer UI (`OnetDrawer.svelte`)

Inside the "Let AI do it" box, above the button:

- Checkbox "Add hidden keywords", bound to `hiddenKeywords.enabled`.
- One line of help text below it, stating plainly that keywords are printed invisibly, that some ATS show extracted text to recruiters or flag hidden text, and that only keywords your resume supports are added.
- When enabled: the current keywords as removable chips, plus a small text input to add one by hand (Enter to add). Same dedupe and cap rules as above.

Exact styling is the builder's call; follow the existing drawer and form conventions, Tailwind classes, and accessibility rules (labelled controls, keyboard operable remove buttons).

### Rendering (`typst-generator.ts`)

When `enabled` and the list is non-empty, append after the ordered sections:

```typst
#place(bottom + left, text(fill: white, size: 1pt)[keyword one, keyword two, ...])
```

- `place` without `float` takes no layout space, so it cannot add a page. It lands on the last page.
- Escape each keyword with the existing `typstMarkup` helper.
- Uses no template helper, so the custom template contract (`REQUIRED_HELPERS`) is unchanged and existing custom templates keep compiling.
- Known limit: a custom template with a non-white page fill would show the text. Matching the page fill (for example via `context page.fill`) is a nice-to-have, builder's call.
- Applies to both document types (resume and CV); the checkbox is the only gate.
- Hidden keywords are excluded from the plain-text copy (`serializeResumeText` in `resume-text.ts`), since that text is shown to people. Add a test that they stay out.

## Tests

Follow `AGENTS.md`: focused tests, then `npm test`, `npm run check`, `npm run lint`, `npm run build`.

- `typst-generator`: block present only when enabled and non-empty; escaping; generated code compiles (wasm test); page count unchanged with a long keyword list.
- `store` / `resume-backup`: old data and old backups without the field load with defaults; new backups round-trip; malformed field rejected or normalized.
- `server/tailor`: prompt and schema unchanged when `keywords` is not requested; keyword section and allowlist present when requested; `validateEdits` keyword rules (not requested, not on allowlist, too long, duplicate, already visible, cap).
- Drawer request: `hiddenKeywords` stripped from the submitted resume; editing keywords mid-rewrite does not trigger the stale path.
- `onet-apply`: append, dedupe, cap, no replacement of existing keywords.
- `isValidTailorResume`: accepts with and without the field.

## Docs and privacy

- README: describe the checkbox and that keywords are stored in browser `localStorage` with the rest of the resume. Hidden keywords never leave the browser; the tailor request only gains a `keywords` flag.
- PR "Risk and deployment": note the added AI output tokens and the ATS detection caveat.

## Left to the builder

- Drawer styling and copy wording within the constraints above.
- Whether to match a custom template's page fill.
- Whether the backup change needs a version bump.
- Exact Typst size (1pt is the target; anything that extracts reliably and is unreadable is fine).
