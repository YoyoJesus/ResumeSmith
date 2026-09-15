import { defaultFontSettings, type FontSettings } from './types';

export interface FontOption {
	family: string;
	/** Font files the compiler must fetch. Built-in Typst fonts need none. */
	files: string[];
}

// Pinned so a Fontsource release cannot change how an exported resume looks.
const FONTSOURCE = 'https://cdn.jsdelivr.net/fontsource/fonts';
const FONTSOURCE_VERSION = '5.3.0';

function fontsource(slug: string): string[] {
	return ['400-normal', '400-italic', '700-normal', '700-italic'].map(
		(variant) => `${FONTSOURCE}/${slug}@${FONTSOURCE_VERSION}/latin-${variant}.ttf`,
	);
}

export const DEFAULT_FONT_FAMILY = 'Libertinus Serif';

export const FONT_OPTIONS: FontOption[] = [
	{ family: DEFAULT_FONT_FAMILY, files: [] },
	{ family: 'New Computer Modern', files: [] },
	{ family: 'Carlito', files: fontsource('carlito') },
	{ family: 'Lato', files: fontsource('lato') },
	{ family: 'Open Sans', files: fontsource('open-sans') },
	{ family: 'Roboto', files: fontsource('roboto') },
];

/** Returns the family only when it is on the curated list, so arbitrary text never reaches Typst. */
export function fontFamily(value: unknown, fallback = DEFAULT_FONT_FAMILY): string {
	return FONT_OPTIONS.some((option) => option.family === value) ? (value as string) : fallback;
}

/** Lists the font files needed to render the given families, without duplicates. */
export function fontFilesFor(families: string[]): string[] {
	const files = FONT_OPTIONS.filter((option) => families.includes(option.family)).flatMap((option) => option.files);
	return [...new Set(files)];
}

// Font sizes go into code position; the sliders, steppers, and generator all share these bounds.
export const FONT_SIZE_BOUNDS: Record<keyof FontSettings, [number, number]> = {
	baseSize: [6, 14],
	nameSize: [14, 32],
	headingSize: [10, 24],
	contactSize: [7, 16],
};

export const FONT_SIZE_STEP = 0.5;

export function stepFontSize(value: number, delta: number, key: keyof FontSettings): number {
	const [min, max] = FONT_SIZE_BOUNDS[key];
	const current = Number.isFinite(value) ? value : defaultFontSettings[key];
	return Math.min(max, Math.max(min, Math.round((current + delta) * 10) / 10));
}
