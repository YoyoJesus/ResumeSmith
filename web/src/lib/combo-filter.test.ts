import { describe, expect, it } from 'vitest';
import { createOptionIndex, filterOptions, normalizeText } from './combo-filter';

describe('combo-filter', () => {
	const sampleSchools = [
		'East Oxford College',
		'Oxford University',
		'Postoxford Institute',
		'University of Oxford',
		'University of California, Berkeley',
		'California Institute of Technology',
		'Université de Montréal',
		'École Polytechnique',
		'Harvard University',
		'Stanford University',
	];

	it('returns an empty array for empty or whitespace-only queries', () => {
		expect(filterOptions(sampleSchools, '')).toEqual([]);
		expect(filterOptions(sampleSchools, '   ')).toEqual([]);
		expect(filterOptions(sampleSchools, '\t\n')).toEqual([]);
	});

	it('returns an empty array when no options match', () => {
		expect(filterOptions(sampleSchools, 'Nonexistent Academy')).toEqual([]);
		expect(filterOptions(sampleSchools, 'xyz123')).toEqual([]);
	});

	it('ranks starts-with first, then word-starts-with, then substring matches, preserving order within ranks', () => {
		const options = ['East Oxford College', 'Oxford University', 'Postoxford Institute', 'University of Oxford'];
		// 'Oxford University' starts with 'oxford' -> rank 0
		// 'East Oxford College' has word 'Oxford' -> rank 1
		// 'University of Oxford' has word 'Oxford' -> rank 1 (after East Oxford College, preserving order)
		// 'Postoxford Institute' has substring 'oxford' -> rank 2
		const results = filterOptions(options, 'oxford');
		expect(results).toEqual([
			'Oxford University',
			'East Oxford College',
			'University of Oxford',
			'Postoxford Institute',
		]);
	});

	it('handles diacritic and case insensitivity', () => {
		expect(normalizeText('ÉCOLE')).toBe('ecole');
		expect(normalizeText('Montréal')).toBe('montreal');

		// Query without diacritics matches accented option
		expect(filterOptions(sampleSchools, 'ecole')).toEqual(['École Polytechnique']);
		expect(filterOptions(sampleSchools, 'montreal')).toEqual(['Université de Montréal']);

		// Query with diacritics matches unaccented / accented option
		expect(filterOptions(sampleSchools, 'école')).toEqual(['École Polytechnique']);
		expect(filterOptions(sampleSchools, 'Montréal')).toEqual(['Université de Montréal']);
	});

	it('requires every whitespace-separated token to appear in the option', () => {
		// "california berkeley" matches "University of California, Berkeley"
		const cal = filterOptions(sampleSchools, 'california berkeley');
		expect(cal).toEqual(['University of California, Berkeley']);

		// "berkeley cal" matches too (different token order)
		const rev = filterOptions(sampleSchools, 'berkeley cal');
		expect(rev).toEqual(['University of California, Berkeley']);

		// If one token is missing, no match
		expect(filterOptions(sampleSchools, 'california harvard')).toEqual([]);
	});

	it('respects the limit parameter', () => {
		const list = ['Option A', 'Option B', 'Option C', 'Option D', 'Option E'];
		expect(filterOptions(list, 'Option', 2)).toEqual(['Option A', 'Option B']);
		expect(filterOptions(list, 'Option', 0)).toEqual([]);
		expect(filterOptions(list, 'Option', 8)).toEqual(list);
	});

	it('createOptionIndex produces reusable search function with same behavior', () => {
		const search = createOptionIndex(sampleSchools);
		expect(search('harvard')).toEqual(['Harvard University']);
		expect(search('oxford', 2)).toEqual(['Oxford University', 'East Oxford College']);
		expect(search('')).toEqual([]);
	});
});
