// Checks the curated web fonts against the Typst compiler the app ships: each file must download,
// and Typst must recognize the family name. Needs network access to jsDelivr, like the default fonts.
import { it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadFonts } from '@myriaddreamin/typst.ts';
import { TypstSnippet } from '@myriaddreamin/typst.ts/dist/esm/contrib/snippet.mjs';
import { FONT_OPTIONS, fontFilesFor } from './fonts';

const COMPILER_WASM = 'node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm';
const RENDERER_WASM = 'node_modules/@myriaddreamin/typst-ts-renderer/pkg/typst_ts_renderer_bg.wasm';
const TIMEOUT = { timeout: 300000 };

function compiler(files: string[]): TypstSnippet {
	const snippet = new TypstSnippet();
	snippet.setCompilerInitOptions({
		getModule: () => readFileSync(COMPILER_WASM).buffer,
		beforeBuild: files.length > 0 ? [loadFonts(files)] : [],
	});
	snippet.setRendererInitOptions({ getModule: () => readFileSync(RENDERER_WASM).buffer });
	return snippet;
}

const sample = (family: string) =>
	`#set page(width: auto, height: auto, margin: 4pt)\n#set text(font: "${family}", fallback: false)\nResume *Bold* _Italic_`;

it('renders every curated family with its own glyphs', TIMEOUT, async () => {
	const families = FONT_OPTIONS.map((option) => option.family);
	const typst = compiler(fontFilesFor(families));
	const outputs = new Map<string, string>();
	for (const family of families) {
		outputs.set(family, await typst.svg({ mainContent: sample(family) }));
	}
	expect(new Set(outputs.values()).size).toBe(families.length);
});

it('keeps the default fonts when web fonts are added', TIMEOUT, async () => {
	const withWebFonts = compiler(fontFilesFor(['Lato']));
	const defaultOnly = compiler([]);
	const doc = sample('Libertinus Serif');
	expect(await withWebFonts.svg({ mainContent: doc })).toEqual(await defaultOnly.svg({ mainContent: doc }));
});
