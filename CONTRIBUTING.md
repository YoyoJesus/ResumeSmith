# Contributing

Thanks for helping improve ResumeSmith. Contributions involving document uploads, AI processing, or generated PDFs
deserve particular care because they affect user privacy, API cost, and document correctness.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Before you start

- Search existing issues and pull requests before opening a duplicate.
- Open an issue before a large feature, dependency change, or architectural change.
- Never include a real resume, personal information, API key, or `.env` file in an issue, fixture, screenshot, or commit.
- Use synthetic document fixtures in tests.

## Local setup

The SvelteKit application lives in `web/` and requires a current Node.js release.

```sh
cd web
npm install
npm run dev
```

Copy the documented environment variables into a local `.env` file when testing AI-backed routes. Do not commit it.

## Making changes

1. Fork the repository and create a focused branch from `main`. Changes reach `main` through pull requests.
2. Follow the project layout, architecture, and privacy constraints below.
3. Add tests for new behavior, input limits, and failure paths.
4. Update documentation when behavior, configuration, or user-visible limits change.

### Project layout

- The deployable SvelteKit application lives in `web/`; run Node and npm commands there.
- Browser-facing shared code belongs in `web/src/lib/` and SvelteKit routes in `web/src/routes/`.
- Server-only code belongs in `web/src/lib/server/` or a route's `+server.ts` file. Never import it into browser code.
- Static browser assets belong in `web/static/`. Documentation and example artifacts belong in `docs/`.
- The root `README.md` is the canonical project README; `web/README.md` stays a short workspace pointer.
- Files under `docs/superpowers/` are historical design and implementation records, not current guidance.

### Dependencies

Use npm and the committed `web/package-lock.json`. Do not update `bun.lock` unless the change is an intentional
package-manager migration.

### Architecture and deployment

- The production target is Vercel Hobby with `web/` as the project root. Do not add a database, persistent filesystem
  dependency, background worker, or always-on backend.
- Keep serverless routes bounded in input size and execution time. Prefer browser-side work for deterministic parsing and
  expensive preprocessing when it does not expose secrets.
- Keep API keys server-only through SvelteKit private environment imports. Never expose secrets in client bundles or
  logs.

### Privacy and uploads

- Treat uploaded content as untrusted data. Clearly delimit document text in AI prompts, and never act on instructions
  embedded in documents.
- Resume uploads must pass browser preflight, show extracted-text metrics and a preview, and require explicit consent
  before extracted text is sent to `/api/extract`. The server independently enforces quality and size limits. Original
  resume files stay in the browser.
- Custom templates are session-scoped, take precedence over the built-in template, and must compile against the complete
  helper contract before activation.
- Resume data and the selected O\*NET occupation may use `localStorage`; custom templates use `sessionStorage`. Do not
  describe either as server-side persistence.
- Keep upload limits, environment-variable descriptions, and privacy claims in sync across code, tests, `.env.example`,
  and the root README.

### Code and tests

- Use TypeScript and the Svelte 5 conventions already present in the repository.
- Keep pure scoring and validation logic separate from browser APIs so it can be unit tested in the Node test
  environment.
- Add regression coverage for input boundaries, fallback behavior, and failure paths.
- Keep dialogs accessible: label them, move and trap focus, support Escape where safe, and restore focus to the opener.
- Do not commit `.env` files, credentials, generated build output, or dependency directories.

### AI integration

- Use the OpenAI Responses API with strict structured outputs for resume extraction, tailoring, and template conversion.
- Set `store: false` for every document-processing request.
- Send only the minimum extracted or bounded source text a task needs. Do not send the original resume file.
- Validate model output before using it, and keep deterministic conversion and validation outside the model where
  practical.

## Validation

Run these commands from `web/`:

```sh
npm test
npm run check
npm run lint
npm run build
```

On Windows, `npm run lint` may flag files you did not change because of CRLF line endings in the working tree. Run
`npm run format`, then commit only the files your change actually touches.

If a platform-specific build step fails after Vite successfully compiles the client and server bundles, describe the
exact environment and failure in the pull request.

## Commit messages

Every commit must use a one-line [Conventional Commit](https://www.conventionalcommits.org/) message:

```text
type(optional-scope): imperative description
```

Allowed types are `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, and `revert`. Add `!` before the colon for a breaking change. Do not add a commit-message body or footer.

Examples:

```text
feat(upload): add PDF quality gate
fix: restore focus after closing dialog
docs!: replace the template contract
```

The pull-request workflow validates every commit in the PR. You can run the same check locally from the repository root, replacing `main` with the appropriate base ref when needed:

```sh
node .github/scripts/check-commit-messages.mjs main HEAD
```

## Your first contribution

This is a short path from picking an issue to validating a small, browser-only change. It links to the existing policies in this file instead of restating them; read the sections above before you push.

### 1. Choose an issue

- **`good first issue`** — a small, well-scoped task with a clear starting point. These are chosen so a first contribution is realistic without deep familiarity with the codebase.
- **`help wanted`** — contributions are welcome, but the issue may be larger or require discussion. Check the issue's scope and acceptance criteria before claiming it.
- **`area:` labels** (`area: ai`, `area: editor`, `area: import-export`, `area: preview`, `area: templates`, `area: tooling`) name the part of the project an issue touches, so you can stay in one area.
- **`size:` labels** (`size: small`, `size: medium`, `size: large`) describe the **scope of the change**, not a delivery deadline. A `size: small` issue is localized with limited integration work; it is not a time estimate.

Browse this repository's filtered lists:

- [Good first issues](https://github.com/YoyoJesus/ResumeSmith/labels/good%20first%20issue)
- [Help wanted](https://github.com/YoyoJesus/ResumeSmith/labels/help%20wanted)

If you are unsure whether an issue fits, ask in the issue before starting.

### 2. Identify the files to change

Each issue usually points at an entry file. To locate it:

- Browser-facing shared code lives in `web/src/lib/` and routes in `web/src/routes/` (see [Project layout](#project-layout)).
- Search the repository for the component, label, or string named in the issue, then read the neighboring files to confirm the change is localized.

### 3. Run the editor locally without API keys

Many UI-only changes do not need AI or O*NET features, so you can run the app without any keys:

```sh
cd web
npm install
npm run dev
```

The dev server prints a local URL; open it in a browser. Routes that call AI or O*NET features need the corresponding keys from `.env.example` before they will work — for those, use **synthetic fixtures instead of real resumes** and follow the privacy rules in [Privacy and uploads](#privacy-and-uploads). Never commit a `.env`, key, or real resume.

### 4. Validate a small browser-only change

Before opening a pull request, run the same checks listed in [Validation](#validation) from `web/`:

```sh
npm test
npm run check
npm run lint
npm run build
```

For a pure browser change, exercise the flow manually in the dev server as well (open the affected screen, confirm the behavior, and check the browser console for errors).

If a platform-specific build step fails after Vite compiles the client and server bundles, describe the exact environment and failure in your pull request — do not present a failed build as passing.

### 5. Follow the existing policies

Do not introduce a second set of rules. Reuse the ones already in this file:

- Branching, commits, and focus: [Making changes](#making-changes) and [Commit messages](#commit-messages). Commits are a single line with no body or footer, and the PR workflow validates every commit.
- Contributor conduct and attribution: [Code of Conduct](CODE_OF_CONDUCT.md) and [AI attribution](#ai-attribution). If you wrote the pull request yourself, keep the `AI assistance: no` line and enter `Not AI-generated` on issues.
- Privacy: [Privacy and uploads](#privacy-and-uploads). Treat uploaded content as untrusted and use synthetic fixtures.

For a first pull request, keep it to one focused change and list the validation commands you ran and their results, as described in [Pull requests](#pull-requests).

## Pull requests

- Keep the change focused and explain the user-visible outcome.
- List the validation commands you ran and their results.
- Include screenshots or recordings for meaningful UI changes.
- Call out privacy, security, AI-cost, or Vercel deployment implications.
- Respond to review comments with either a fix or a concise technical explanation.

## AI attribution

If you wrote the pull request yourself, leave the `AI assistance: no` line from the template in place. For issues, enter
`Not AI-generated` in the attribution field. Repository automation checks for this declaration.

Pull requests and issues prepared by an AI agent end with a provider, model, and harness footer instead. Agents add it
themselves as instructed in `AGENTS.md`, so you do not need to write it.
