import { describe, expect, it } from 'vitest';
import { sameRevision, applyTailorReview, stageTailorReview, undoTailorReview } from './onet-review';
import { defaultResumeData, type ResumeData } from './types';
import type { TailorEdit } from './onet-types';

function seed(): ResumeData {
	return {
		...structuredClone(defaultResumeData),
		profile: { summary: 'Original summary' },
		workExperience: [
			{
				id: 'w1',
				title: 'Engineer',
				company: 'Example',
				location: '',
				startDate: '',
				endDate: '',
				isPresent: true,
				bullets: ['', 'First bullet', '', 'Second bullet'],
			},
		],
		projects: [{ id: 'p1', name: 'Project', stack: 'TypeScript', url: '', award: '', bullets: ['Project bullet'] }],
		skills: [{ id: 's1', category: 'Languages', skills: 'TypeScript' }],
		achievements: [{ id: 'a1', title: 'Award', date: '', description: 'Original award' }],
	};
}

function edit(kind: TailorEdit['kind'], targetId: string, text = '', bulletIndex = -1): TailorEdit {
	return { kind, targetId, text, bulletIndex };
}

function stage(data: ResumeData, edits: TailorEdit[]) {
	return stageTailorReview(structuredClone(data), data, edits).suggestions;
}

describe('stageTailorReview', () => {
	it('stages every edit kind with meaningful locations and actual before/after text without mutation', () => {
		const data = seed();
		const original = structuredClone(data);
		const edits = [
			edit('add_bullet', 'p1', 'Added bullet'),
			edit('rewrite_bullet', 'w1', 'Revised first', 0),
			edit('remove_bullet', 'w1', '', 1),
			edit('rewrite_field', 'profile', 'New summary'),
			edit('set_font', 'baseSize', '9'),
			edit('skill', 's1', 'Go'),
			edit('keyword', 'keywords', 'Splunk'),
			edit('rewrite_field', 'project-stack:p1', 'Go'),
			edit('rewrite_field', 'achievement-description:a1', 'New award'),
		];
		const input = structuredClone(edits);
		const suggestions = stage(data, edits);
		expect(suggestions.map(({ before, after }) => [before, after])).toEqual([
			['', 'Added bullet'],
			['First bullet', 'Revised first'],
			['Second bullet', ''],
			['Original summary', 'New summary'],
			['8.7 pt', '9 pt'],
			['TypeScript', 'TypeScript, Go'],
			['', 'Splunk'],
			['TypeScript', 'Go'],
			['Original award', 'New award'],
		]);
		expect(suggestions.every((item) => item.label && item.location)).toBe(true);
		expect(new Set(suggestions.map((item) => item.id)).size).toBe(edits.length);
		expect(stage(data, edits)).toEqual(suggestions);
		expect(data).toEqual(original);
		expect(edits).toEqual(input);
		suggestions[0].edit.text = 'Changed suggestion';
		expect(edits).toEqual(input);
	});

	it('excludes no-ops, missing targets, invalid indexes and fonts, and duplicate additions', () => {
		const data = seed();
		data.hiddenKeywords.keywords = ['Splunk'];
		const edits = [
			edit('rewrite_field', 'profile', data.profile.summary),
			edit('rewrite_bullet', 'w1', 'First bullet', 0),
			edit('remove_bullet', 'w1', '', 2),
			edit('rewrite_bullet', 'w1', 'X', -1),
			edit('rewrite_bullet', 'w1', 'X', 0.5),
			edit('add_bullet', 'missing', 'X'),
			edit('rewrite_field', 'missing', 'X'),
			edit('skill', 'missing', 'Go'),
			edit('skill', 's1', 'typescript'),
			edit('keyword', 'keywords', 'splunk'),
			edit('keyword', 'wrong', 'Nessus'),
			edit('keyword', 'keywords', 'x'.repeat(81)),
			edit('set_font', 'toString', '9'),
			edit('set_font', 'baseSize', '999'),
			edit('set_font', 'baseSize', 'NaN'),
			edit('add_bullet', 'p1', ' '),
			edit('add_bullet', 'p1', 'Project bullet'),
		];
		expect(stage(data, edits)).toEqual([]);
		expect(stage(data, [edit('skill', 's1', 'Go'), edit('skill', 's1', 'go')])).toHaveLength(1);
		expect(stage(data, [edit('keyword', 'keywords', 'Nessus'), edit('keyword', 'keywords', 'nessus')])).toHaveLength(1);
		expect(stage(data, [edit('add_bullet', 'p1', 'Added'), edit('add_bullet', 'p1', 'Added')])).toHaveLength(1);
	});

	it('lets removal win conflicting rewrites in either input order and deduplicates removals', () => {
		const data = seed();
		const rewrite = edit('rewrite_bullet', 'w1', 'Rewritten', 0);
		const removal = edit('remove_bullet', 'w1', '', 0);
		for (const edits of [
			[rewrite, removal, removal],
			[removal, rewrite],
		]) {
			expect(stage(data, edits).map((item) => item.edit)).toEqual([removal]);
		}
	});

	it('keeps the first effective competing replacement', () => {
		const data = seed();
		const edits = [
			edit('rewrite_field', 'profile', data.profile.summary),
			edit('rewrite_field', 'profile', 'First'),
			edit('rewrite_field', 'profile', 'Second'),
			edit('rewrite_bullet', 'w1', 'First rewrite', 0),
			edit('rewrite_bullet', 'w1', 'Second rewrite', 0),
		];
		expect(stage(data, edits).map((item) => item.edit.text)).toEqual(['First', 'First rewrite']);
	});

	it('excludes keywords beyond capacity and preserves the enabled setting', () => {
		const data = seed();
		data.hiddenKeywords.keywords = Array.from({ length: 29 }, (_, i) => `Term ${i}`);
		const suggestions = stage(data, [edit('keyword', 'keywords', 'One'), edit('keyword', 'keywords', 'Two')]);
		expect(suggestions).toHaveLength(1);
		const result = applyTailorReview(
			data,
			data,
			suggestions,
			suggestions.map((item) => item.id),
		);
		expect(result.keywordsAdded).toBe(1);
		expect(result.data.hiddenKeywords.enabled).toBe(false);
	});

	it.each(['content', 'keywords', 'enabled', 'styling', 'custom section'] as const)(
		'rejects a stale full revision after %s changes',
		(change) => {
			const submitted = seed();
			const current = structuredClone(submitted);
			if (change === 'content') current.personalInfo.name = 'Changed';
			if (change === 'keywords') current.hiddenKeywords.keywords.push('Later');
			if (change === 'enabled') current.hiddenKeywords.enabled = true;
			if (change === 'styling') current.fontFamilies.body = 'Other';
			if (change === 'custom section') current.customSections.push({ id: 'custom', heading: 'Extra', entries: [] });
			expect(stageTailorReview(submitted, current, [edit('skill', 's1', 'Go')])).toEqual({
				stale: true,
				suggestions: [],
			});
		},
	);

	it('accepts equal data with different object property insertion order', () => {
		const data = seed();
		const { hiddenKeywords, ...rest } = data;
		expect(stageTailorReview({ hiddenKeywords, ...rest }, data, []).stale).toBe(false);
	});
});

describe('applyTailorReview and undoTailorReview', () => {
	it('applies only selected suggestions as one independently snapshotted undo transaction', () => {
		const data = seed();
		const before = structuredClone(data);
		const suggestions = stage(data, [
			edit('skill', 's1', 'Go'),
			edit('rewrite_field', 'profile', 'Accepted'),
			edit('keyword', 'keywords', 'Nessus'),
		]);
		const result = applyTailorReview(data, data, suggestions, [suggestions[1].id, suggestions[2].id, 'unknown']);
		expect(result.applied).toBe(2);
		expect(result.data.skills).toEqual(before.skills);
		expect(result.data.profile.summary).toBe('Accepted');
		expect(result.paths).toEqual(['profile.summary']);
		expect(result.keywordsAdded).toBe(1);
		expect(result.undo).toEqual({ before, after: result.data });
		expect(data).toEqual(before);
		const undone = undoTailorReview(result.data, result.undo!);
		expect(undone).toEqual({ data: before, stale: false, undone: true });
		undone.data.profile.summary = 'Mutated restored object';
		expect(result.undo!.before.profile.summary).toBe(before.profile.summary);
		result.data.profile.summary = 'Later mutation';
		expect(result.undo!.after.profile.summary).toBe('Accepted');
	});

	it('preserves compressed bullet indexing and highlights through multiple removals', () => {
		const data = seed();
		const suggestions = stage(data, [
			edit('remove_bullet', 'w1', '', 0),
			edit('rewrite_bullet', 'w1', 'Second revised', 1),
			edit('add_bullet', 'w1', 'Third'),
		]);
		const result = applyTailorReview(
			data,
			data,
			suggestions,
			suggestions.map((item) => item.id),
		);
		expect(result.data.workExperience[0].bullets).toEqual(['', '', 'Second revised', 'Third']);
		expect(result.paths).toEqual(['workExperience.0.bullets.2', 'workExperience.0.bullets.3']);
		expect(result.removed).toBe(1);
		expect(undoTailorReview(result.data, result.undo!).data).toEqual(data);
	});

	it('supports education and leadership bullet review and undo', () => {
		const data = seed();
		data.education = [
			{
				id: 'e1',
				institution: 'School',
				degree: 'Degree',
				major: '',
				concentration: '',
				minor: '',
				location: '',
				startDate: '',
				endDate: '',
				isPresent: false,
				bullets: ['Study'],
			},
		];
		data.leadership = [
			{
				id: 'l1',
				title: 'Lead',
				organization: 'Club',
				location: '',
				startDate: '',
				endDate: '',
				isPresent: false,
				bullets: ['Organized'],
			},
		];
		const suggestions = stage(data, [edit('rewrite_bullet', 'e1', 'Studied', 0), edit('remove_bullet', 'l1', '', 0)]);
		expect(suggestions.map((item) => item.before)).toEqual(['Study', 'Organized']);
		const result = applyTailorReview(
			data,
			data,
			suggestions,
			suggestions.map((item) => item.id),
		);
		expect(result.data.education[0].bullets).toEqual(['Studied']);
		expect(result.data.leadership[0].bullets).toEqual([]);
		expect(undoTailorReview(result.data, result.undo!).data).toEqual(data);
	});

	it('does not apply or create undo for an empty selection', () => {
		const data = seed();
		const result = applyTailorReview(data, data, stage(data, [edit('skill', 's1', 'Go')]), []);
		expect(result.data).toBe(data);
		expect(result).toMatchObject({ stale: false, applied: 0, undo: null });
	});

	it('rejects acceptance if hidden keywords changed after staging', () => {
		const data = seed();
		const suggestions = stage(data, [edit('skill', 's1', 'Go')]);
		const changed = structuredClone(data);
		changed.hiddenKeywords.keywords.push('Later');
		const result = applyTailorReview(
			data,
			changed,
			suggestions,
			suggestions.map((item) => item.id),
		);
		expect(result).toMatchObject({ stale: true, applied: 0, undo: null });
		expect(result.data).toBe(changed);
	});

	it.each(['visible', 'keywords', 'enabled', 'styling'] as const)('refuses undo after later %s edits', (change) => {
		const data = seed();
		const suggestions = stage(data, [edit('rewrite_field', 'profile', 'Accepted')]);
		const result = applyTailorReview(data, data, suggestions, [suggestions[0].id]);
		const changed = structuredClone(result.data);
		if (change === 'visible') changed.personalInfo.name = 'Later';
		if (change === 'keywords') changed.hiddenKeywords.keywords.push('Later');
		if (change === 'enabled') changed.hiddenKeywords.enabled = true;
		if (change === 'styling') changed.fonts.baseSize++;
		const undone = undoTailorReview(changed, result.undo!);
		expect(undone).toEqual({ data: changed, stale: true, undone: false });
		expect(undone.data).toBe(changed);
	});
});

describe('sameRevision', () => {
	it('keeps UI, apply, and undo guards consistent for reordered nested object keys', () => {
		const data = seed();
		const reorder = (value: ResumeData): ResumeData =>
			JSON.parse(
				JSON.stringify(value, (_, item) =>
					item && typeof item === 'object' && !Array.isArray(item)
						? Object.fromEntries(Object.entries(item).reverse())
						: item,
				),
			);
		const restored = reorder(data);
		expect(JSON.stringify(restored)).not.toBe(JSON.stringify(data));
		expect(sameRevision(data, restored)).toBe(true);
		const suggestions = stage(data, [edit('rewrite_field', 'profile', 'Accepted')]);
		const applied = applyTailorReview(data, restored, suggestions, [suggestions[0].id]);
		expect(applied.stale).toBe(false);
		const reorderedAfter = reorder(applied.data);
		expect(sameRevision(applied.undo!.after, reorderedAfter)).toBe(true);
		expect(undoTailorReview(reorderedAfter, applied.undo!).data).toEqual(data);
		reorderedAfter.workExperience[0].bullets.reverse();
		expect(sameRevision(applied.undo!.after, reorderedAfter)).toBe(false);
		expect(undoTailorReview(reorderedAfter, applied.undo!).stale).toBe(true);
	});
});
