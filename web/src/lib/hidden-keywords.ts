import type { HiddenKeywords, ResumeData } from './types';

export const MAX_HIDDEN_KEYWORDS = 30;
export const MAX_HIDDEN_KEYWORD_CHARS = 80;

export function addHiddenKeywords(existing: string[], additions: string[]): string[] {
	const keywords = [...existing];
	const seen = new Set(existing.map((keyword) => keyword.toLowerCase()));
	for (const addition of additions) {
		if (keywords.length >= MAX_HIDDEN_KEYWORDS) break;
		const keyword = addition.trim();
		const folded = keyword.toLowerCase();
		if (!keyword || keyword.length > MAX_HIDDEN_KEYWORD_CHARS || seen.has(folded)) continue;
		keywords.push(keyword);
		seen.add(folded);
	}
	return keywords;
}

export function tryAddHiddenKeyword(existing: string[], input: string): { keywords: string[]; error: string } {
	const keywords = addHiddenKeywords(existing, [input]);
	if (keywords.length > existing.length) return { keywords, error: '' };
	const keyword = input.trim();
	const error = !keyword
		? 'Enter a keyword.'
		: existing.length >= MAX_HIDDEN_KEYWORDS
			? `You can add up to ${MAX_HIDDEN_KEYWORDS} hidden keywords.`
			: keyword.length > MAX_HIDDEN_KEYWORD_CHARS
				? `Keywords must be ${MAX_HIDDEN_KEYWORD_CHARS} characters or fewer.`
				: 'That keyword is already in the list.';
	return { keywords, error };
}

export function normalizeHiddenKeywords(value: unknown): HiddenKeywords {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return { enabled: false, keywords: [] };
	}
	const settings = value as Record<string, unknown>;
	return {
		enabled: settings.enabled === true,
		keywords: addHiddenKeywords(
			[],
			Array.isArray(settings.keywords)
				? settings.keywords.filter((keyword): keyword is string => typeof keyword === 'string')
				: [],
		),
	};
}

export function withoutHiddenKeywords(data: ResumeData): Omit<ResumeData, 'hiddenKeywords'> {
	const { hiddenKeywords, ...rest } = data;
	return rest;
}
