import { describe, expect, it } from 'vitest';
import { joinYearMonth, MONTHS, splitYearMonth } from './year-month';

describe('splitYearMonth', () => {
	it('handles empty and whitespace-only strings', () => {
		expect(splitYearMonth('')).toEqual({ year: '', month: '' });
		expect(splitYearMonth('   ')).toEqual({ year: '', month: '' });
	});

	it('handles year only', () => {
		expect(splitYearMonth('2024')).toEqual({ year: '2024', month: '' });
		expect(splitYearMonth('1999')).toEqual({ year: '1999', month: '' });
	});

	it('handles standard YYYY-MM strings', () => {
		expect(splitYearMonth('2024-01')).toEqual({ year: '2024', month: '01' });
		expect(splitYearMonth('2024-12')).toEqual({ year: '2024', month: '12' });
	});

	it('pads single-digit month to two digits', () => {
		expect(splitYearMonth('2024-5')).toEqual({ year: '2024', month: '05' });
		expect(splitYearMonth('2024-1')).toEqual({ year: '2024', month: '01' });
		expect(splitYearMonth('2024-9')).toEqual({ year: '2024', month: '09' });
	});

	it('rejects month 00 and 13', () => {
		expect(splitYearMonth('2024-00')).toEqual({ year: '', month: '' });
		expect(splitYearMonth('2024-0')).toEqual({ year: '', month: '' });
		expect(splitYearMonth('2024-13')).toEqual({ year: '', month: '' });
		expect(splitYearMonth('2024-99')).toEqual({ year: '', month: '' });
	});

	it('rejects non-numeric text such as Fall 2023', () => {
		expect(splitYearMonth('Fall 2023')).toEqual({ year: '', month: '' });
		expect(splitYearMonth('Spring 2020')).toEqual({ year: '', month: '' });
		expect(splitYearMonth('present')).toEqual({ year: '', month: '' });
	});

	it('tolerates surrounding whitespace', () => {
		expect(splitYearMonth('  2024-05  ')).toEqual({ year: '2024', month: '05' });
		expect(splitYearMonth('\t2024\n')).toEqual({ year: '2024', month: '' });
		expect(splitYearMonth('  2024-7  ')).toEqual({ year: '2024', month: '07' });
	});

	it('rejects partially typed years', () => {
		expect(splitYearMonth('2')).toEqual({ year: '', month: '' });
		expect(splitYearMonth('20')).toEqual({ year: '', month: '' });
		expect(splitYearMonth('202')).toEqual({ year: '', month: '' });
		expect(splitYearMonth('20-05')).toEqual({ year: '', month: '' });
		expect(splitYearMonth('20245')).toEqual({ year: '', month: '' });
	});
});

describe('joinYearMonth', () => {
	it('returns YYYY-MM when year is 4 digits and month is chosen', () => {
		expect(joinYearMonth('2024', '05')).toBe('2024-05');
		expect(joinYearMonth('2024', '12')).toBe('2024-12');
		expect(joinYearMonth('1995', '01')).toBe('1995-01');
	});

	it('formats single-digit month with zero-padding', () => {
		expect(joinYearMonth('2024', '5')).toBe('2024-05');
		expect(joinYearMonth('2024', '1')).toBe('2024-01');
	});

	it('returns YYYY when year is 4 digits and month is empty', () => {
		expect(joinYearMonth('2024', '')).toBe('2024');
		expect(joinYearMonth('2024', '   ')).toBe('2024');
	});

	it('handles surrounding whitespace on valid inputs', () => {
		expect(joinYearMonth('  2024  ', '  05  ')).toBe('2024-05');
		expect(joinYearMonth('  2024  ', '')).toBe('2024');
	});

	it('returns empty string when year is not 4 digits', () => {
		expect(joinYearMonth('', '05')).toBe('');
		expect(joinYearMonth('20', '05')).toBe('');
		expect(joinYearMonth('202', '05')).toBe('');
		expect(joinYearMonth('20', '')).toBe('');
		expect(joinYearMonth('20245', '05')).toBe('');
		expect(joinYearMonth('Fall 2023', '')).toBe('');
		expect(joinYearMonth('abcd', '05')).toBe('');
	});

	it('returns empty string when month is invalid (00, 13, non-numeric)', () => {
		expect(joinYearMonth('2024', '00')).toBe('');
		expect(joinYearMonth('2024', '0')).toBe('');
		expect(joinYearMonth('2024', '13')).toBe('');
		expect(joinYearMonth('2024', '99')).toBe('');
		expect(joinYearMonth('2024', 'May')).toBe('');
	});
});

describe('MONTHS', () => {
	it('provides all 12 zero-padded months with full English names', () => {
		expect(MONTHS).toHaveLength(12);
		expect(MONTHS[0]).toEqual({ value: '01', label: 'January' });
		expect(MONTHS[11]).toEqual({ value: '12', label: 'December' });
	});
});
