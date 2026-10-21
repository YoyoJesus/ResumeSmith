import { describe, expect, it } from 'vitest';
import {
	addHiddenKeywords,
	normalizeHiddenKeywords,
	tryAddHiddenKeyword,
	withoutHiddenKeywords,
} from './hidden-keywords';
import { defaultResumeData } from './types';

describe('hidden keywords', () => {
	it('appends valid additions in order and skips duplicates and invalid entries', () => {
		expect(addHiddenKeywords(['SQL'], [' sql ', 'Python', '', 'x'.repeat(81), 'python'])).toEqual(['SQL', 'Python']);
	});

	it('stops at 30 keywords', () => {
		const keywords = addHiddenKeywords(
			Array.from({ length: 29 }, (_, i) => `k${i}`),
			['a', 'b'],
		);
		expect(keywords).toHaveLength(30);
		expect(keywords.at(-1)).toBe('a');
	});

	it('reports why a manual entry was rejected and preserves the current list', () => {
		const full = Array.from({ length: 30 }, (_, i) => `term ${i}`);
		expect(tryAddHiddenKeyword(['SQL'], 'x'.repeat(81))).toEqual({
			keywords: ['SQL'],
			error: 'Keywords must be 80 characters or fewer.',
		});
		expect(tryAddHiddenKeyword(full, 'new term')).toEqual({
			keywords: full,
			error: 'You can add up to 30 hidden keywords.',
		});
		expect(tryAddHiddenKeyword(['SQL'], ' sql ')).toEqual({
			keywords: ['SQL'],
			error: 'That keyword is already in the list.',
		});
		expect(tryAddHiddenKeyword(['SQL'], ' Python ')).toEqual({ keywords: ['SQL', 'Python'], error: '' });
	});

	it('uses defaults for non-objects', () => {
		expect(normalizeHiddenKeywords(undefined)).toEqual({ enabled: false, keywords: [] });
		expect(normalizeHiddenKeywords('x')).toEqual({ enabled: false, keywords: [] });
	});

	it('normalizes the enabled flag and keyword entries', () => {
		expect(normalizeHiddenKeywords({ enabled: 'yes', keywords: ['A', 3, 'a', 'B'] })).toEqual({
			enabled: false,
			keywords: ['A', 'B'],
		});
	});

	it('removes hidden keywords from a copy of resume data', () => {
		expect('hiddenKeywords' in withoutHiddenKeywords(defaultResumeData)).toBe(false);
	});
});
