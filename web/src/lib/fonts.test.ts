import { describe, it, expect } from 'vitest';
import { DEFAULT_FONT_FAMILY, FONT_OPTIONS, fontFamily, fontFilesFor, stepFontSize } from './fonts';

describe('fontFamily', () => {
	it('keeps a curated family', () => {
		expect(fontFamily('Lato')).toBe('Lato');
	});

	it('falls back for unknown or injected values', () => {
		expect(fontFamily('Comic Sans')).toBe(DEFAULT_FONT_FAMILY);
		expect(fontFamily('Lato"); #eval("1')).toBe(DEFAULT_FONT_FAMILY);
		expect(fontFamily(undefined, 'Roboto')).toBe('Roboto');
	});
});

describe('fontFilesFor', () => {
	it('needs no downloads for built-in Typst fonts', () => {
		expect(fontFilesFor([DEFAULT_FONT_FAMILY, 'New Computer Modern'])).toEqual([]);
	});

	it('returns each web font file once when heading and body share a family', () => {
		const files = fontFilesFor(['Lato', 'Lato']);
		expect(files).toHaveLength(4);
		expect(new Set(files).size).toBe(4);
		expect(files.every((file) => file.startsWith('https://cdn.jsdelivr.net/fontsource/fonts/lato@5.3.0/'))).toBe(true);
	});

	it('ignores families that are not on the list', () => {
		expect(fontFilesFor(['https://evil.example/font.ttf'])).toEqual([]);
	});

	it('pins every web font to a fixed version', () => {
		const files = FONT_OPTIONS.flatMap((option) => option.files);
		expect(files.every((file) => /@\d+\.\d+\.\d+\//.test(file))).toBe(true);
	});
});

describe('stepFontSize', () => {
	it('moves by the step without floating-point drift', () => {
		expect(stepFontSize(8.7, 0.5, 'baseSize')).toBe(9.2);
		expect(stepFontSize(8.7, -0.5, 'baseSize')).toBe(8.2);
	});

	it('clamps to the slider bounds', () => {
		expect(stepFontSize(31.8, 0.5, 'nameSize')).toBe(32);
		expect(stepFontSize(6.2, -0.5, 'baseSize')).toBe(6);
	});

	it('recovers from a non-numeric value', () => {
		expect(stepFontSize(Number.NaN, 0.5, 'contactSize')).toBe(11.7);
	});
});
