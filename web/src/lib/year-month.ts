const YEAR_MONTH = /^(\d{4})-(\d{1,2})$/;
const YEAR = /^\d{4}$/;
const MONTH = /^(0?[1-9]|1[0-2])$/;

export const MONTHS = [
	{ value: '01', label: 'January' },
	{ value: '02', label: 'February' },
	{ value: '03', label: 'March' },
	{ value: '04', label: 'April' },
	{ value: '05', label: 'May' },
	{ value: '06', label: 'June' },
	{ value: '07', label: 'July' },
	{ value: '08', label: 'August' },
	{ value: '09', label: 'September' },
	{ value: '10', label: 'October' },
	{ value: '11', label: 'November' },
	{ value: '12', label: 'December' },
] as const;

export function splitYearMonth(value: string): { year: string; month: string } {
	if (typeof value !== 'string') return { year: '', month: '' };
	const trimmed = value.trim();
	const match = YEAR_MONTH.exec(trimmed);
	if (match) {
		const monthNum = Number(match[2]);
		if (monthNum < 1 || monthNum > 12) return { year: '', month: '' };
		return { year: match[1], month: String(monthNum).padStart(2, '0') };
	}
	if (YEAR.test(trimmed)) {
		return { year: trimmed, month: '' };
	}
	return { year: '', month: '' };
}

export function joinYearMonth(year: string, month: string): string {
	if (typeof year !== 'string' || typeof month !== 'string') return '';
	const y = year.trim();
	if (!YEAR.test(y)) return '';
	const m = month.trim();
	if (m === '') return y;
	const match = MONTH.exec(m);
	if (!match) return '';
	const monthNum = Number(match[1]);
	return `${y}-${String(monthNum).padStart(2, '0')}`;
}
