import type { ResumeData, ExtractedResume, DocumentType, FontSettings } from './types';
import { defaultResumeData, defaultFontSettings, defaultSectionOrder, cvFontSettings } from './types';
import { joinYearMonth, splitYearMonth } from './year-month';

const documentFontDefaults: Record<DocumentType, FontSettings> = { resume: defaultFontSettings, cv: cvFontSettings };

/** Switches document type, moving untouched font sizes to the new type's defaults but keeping any the user chose. */
export function withDocumentType(data: ResumeData, documentType: DocumentType): ResumeData {
	if (data.documentType === documentType) return data;
	const previousDefaults = documentFontDefaults[data.documentType];
	const untouched = (Object.keys(previousDefaults) as (keyof FontSettings)[]).every(
		(key) => data.fonts[key] === previousDefaults[key],
	);
	return {
		...data,
		documentType,
		fonts: untouched ? { ...documentFontDefaults[documentType] } : data.fonts,
	};
}

/** Coerces a date to "YYYY-MM", "YYYY" or "" so it renders and passes backup validation. */
export function normalizeDate(value: unknown): string {
	const { year, month } = splitYearMonth(value as string);
	return joinYearMonth(year, month);
}

/** Normalizes the named date fields of each item. */
export function normalizeDates<T extends object>(items: T[], keys: (keyof T)[]): T[] {
	return items.map((item) => {
		const copy = { ...item };
		for (const key of keys) copy[key] = normalizeDate(item[key]) as T[keyof T];
		return copy;
	});
}

export function generateId(): string {
	return Math.random().toString(36).substring(2, 9);
}

export function toSingleLine(value: string): string {
	return value.replace(/[\r\n]+/g, ' ');
}

// Estimate if resume exceeds one page (rough heuristic based on content)
export function estimateOverOnePage(data: ResumeData): boolean {
	let lines = 0;
	lines += data.profile.summary ? 2 : 0;
	lines += data.education.length * 3;
	data.education.forEach((e) => (lines += e.bullets.filter((b) => b).length));
	lines += data.projects.length * 2;
	data.projects.forEach((p) => (lines += p.bullets.filter((b) => b).length));
	lines += data.workExperience.length * 3;
	data.workExperience.forEach((w) => (lines += w.bullets.filter((b) => b).length));
	lines += data.leadership.length * 3;
	data.leadership.forEach((l) => (lines += l.bullets.filter((b) => b).length));
	lines += data.skills.length * 1;
	lines += data.achievements.length * 2;
	lines += data.clearance.length * 2;
	lines += data.publications.length * 2;
	return lines > 55; // Rough estimate for one page
}

// Convert AI-extracted content into a full ResumeData: add ids + default styling.
export function buildResumeFromExtraction(ex: ExtractedResume): ResumeData {
	const withId = <T>(items: T[]): (T & { id: string })[] => items.map((item) => ({ ...item, id: generateId() }));

	return {
		documentType: 'resume',
		personalInfo: { ...defaultResumeData.personalInfo, ...ex.personalInfo },
		profile: { summary: ex.profile?.summary ?? '' },
		education: withId(normalizeDates(ex.education ?? [], ['startDate', 'endDate'])),
		projects: withId(ex.projects ?? []),
		workExperience: withId(normalizeDates(ex.workExperience ?? [], ['startDate', 'endDate'])),
		leadership: withId(normalizeDates(ex.leadership ?? [], ['startDate', 'endDate'])),
		skills: withId(ex.skills ?? []),
		achievements: withId(normalizeDates(ex.achievements ?? [], ['date'])),
		publications: withId(ex.publications ?? []).map((publication) => ({
			...publication,
			volume: '',
			issue: '',
			pages: '',
			doi: '',
			status: 'published' as const,
		})),
		publicationAuthorName: '',
		presentations: [],
		customSections: [],
		hiddenKeywords: { enabled: false, keywords: [] },
		clearance: withId(normalizeDates(ex.clearance ?? [], ['dateGranted'])),
		colors: { ...defaultResumeData.colors },
		fonts: { ...defaultFontSettings },
		fontFamilies: { ...defaultResumeData.fontFamilies },
		sectionOrder: [...defaultSectionOrder],
	};
}
