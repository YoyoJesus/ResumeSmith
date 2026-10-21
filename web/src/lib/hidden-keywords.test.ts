import { describe, expect, it } from 'vitest';
import { addHiddenKeywords, normalizeHiddenKeywords, withoutHiddenKeywords } from './hidden-keywords';
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
