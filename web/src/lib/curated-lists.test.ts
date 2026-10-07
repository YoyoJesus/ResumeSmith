import { describe, expect, it } from 'vitest';
import { DEGREES } from './degrees';
import { MAJORS } from './majors';

describe('curated lists', () => {
	describe('DEGREES', () => {
		it('contains no empty or untrimmed entries', () => {
			expect(DEGREES.length).toBeGreaterThan(0);
			for (const deg of DEGREES) {
				expect(deg.trim().length).toBeGreaterThan(0);
				expect(deg).toBe(deg.trim());
			}
		});

		it('contains no duplicates', () => {
			const set = new Set(DEGREES);
			expect(set.size).toBe(DEGREES.length);
		});
	});

	describe('MAJORS', () => {
		it('contains no empty or untrimmed entries', () => {
			expect(MAJORS.length).toBeGreaterThan(0);
			for (const major of MAJORS) {
				expect(major.trim().length).toBeGreaterThan(0);
				expect(major).toBe(major.trim());
			}
		});

		it('contains no duplicates', () => {
			const set = new Set(MAJORS);
			expect(set.size).toBe(MAJORS.length);
		});

		it('has roughly 150 to 220 entries', () => {
			expect(MAJORS.length).toBeGreaterThanOrEqual(150);
			expect(MAJORS.length).toBeLessThanOrEqual(220);
		});

		it('is alphabetically sorted', () => {
			const sorted = [...MAJORS].sort((a, b) => a.localeCompare(b));
			expect(MAJORS).toEqual(sorted);
		});
	});
});
