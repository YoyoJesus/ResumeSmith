import { describe, it, expect } from 'vitest';
import {
	validateEdits,
	MAX_EDITS,
	buildTailorInput,
	isValidTailorResume,
	TAILOR_SCHEMA,
	MAX_FIELD_CHARS,
	MAX_SKILL_CHARS,
	isValidCompiledPageCount,
	tailorSchema,
	occupationTerms,
	MAX_KEYWORD_EDITS,
} from './tailor';
import { defaultResumeData } from '$lib/types';
import type { ResumeData } from '$lib/types';
import type { OnetOccupation } from '$lib/onet-types';

const allowed = { bullets: new Set(['w1', 'p1']), skills: new Set(['s1']) };

function edit(over: Record<string, unknown> = {}) {
	return { kind: 'add_bullet', targetId: 'w1', text: 'Shipped a thing.', bulletIndex: -1, ...over };
}

describe('validateEdits', () => {
	it('offers keyword edits only in the opted-in schema', () => {
		expect(tailorSchema(false)).toEqual({
			type: 'object',
			additionalProperties: false,
			required: ['edits'],
			properties: {
				edits: {
					type: 'array',
					items: {
						type: 'object',
						additionalProperties: false,
						required: ['kind', 'targetId', 'text', 'bulletIndex'],
						properties: {
							kind: {
								type: 'string',
								enum: ['add_bullet', 'rewrite_bullet', 'remove_bullet', 'rewrite_field', 'set_font', 'skill'],
							},
							targetId: { type: 'string' },
							text: { type: 'string' },
							bulletIndex: { type: 'integer', minimum: -1 },
						},
					},
				},
			},
		});
		expect(TAILOR_SCHEMA).toEqual(tailorSchema(false));
		expect(tailorSchema(true).properties.edits.items.properties.kind.enum).toContain('keyword');
	});

	it('accepts only canonical, supported, unseen keyword terms with the keyword target', () => {
		const targets = {
			...allowed,
			keywords: new Map([
				['splunk', 'Splunk'],
				['python', 'Python'],
			]),
			visibleText: 'python',
		};
		const keyword = (over: Record<string, unknown> = {}) =>
			edit({ kind: 'keyword', targetId: 'keywords', text: ' SPLUNK ', bulletIndex: -1, ...over });
		expect(validateEdits({ edits: [keyword()] }, targets)).toEqual([
			{ kind: 'keyword', targetId: 'keywords', text: 'Splunk', bulletIndex: -1 },
		]);
		expect(validateEdits({ edits: [keyword({ text: 'Kubernetes' })] }, targets)).toEqual([]);
		expect(validateEdits({ edits: [keyword({ text: 'Python' })] }, targets)).toEqual([]);
		expect(validateEdits({ edits: [keyword(), keyword({ text: 'splunk' })] }, targets)).toHaveLength(1);
		expect(validateEdits({ edits: [keyword()] }, allowed)).toEqual([]);
		expect(validateEdits({ edits: [keyword({ bulletIndex: 0 })] }, targets)).toEqual([]);
		expect(validateEdits({ edits: [keyword({ targetId: 'x' })] }, targets)).toEqual([]);
		expect(validateEdits({ edits: [keyword({ text: 's'.repeat(81) })] }, targets)).toEqual([]);
	});

	it('caps keyword edits separately from other edits', () => {
		const names = Array.from({ length: MAX_KEYWORD_EDITS + 5 }, (_, i) => `Term ${i}`);
		const targets = { ...allowed, keywords: new Map(names.map((name) => [name.toLowerCase(), name])), visibleText: '' };
		const bullets = Array.from({ length: MAX_EDITS }, (_, i) => edit({ text: `Bullet ${i}` }));
		const keywords = names.map((text) => edit({ kind: 'keyword', targetId: 'keywords', text, bulletIndex: -1 }));
		expect(validateEdits({ edits: [...bullets, ...keywords.slice(0, 5)] }, targets)).toHaveLength(MAX_EDITS + 5);
		const result = validateEdits({ edits: [...bullets, ...keywords] }, targets);
		expect(result.filter((item) => item.kind === 'add_bullet')).toHaveLength(MAX_EDITS);
		expect(result.filter((item) => item.kind === 'keyword')).toHaveLength(MAX_KEYWORD_EDITS);
		expect(validateEdits({ edits: [...keywords, ...bullets] }, targets)).toHaveLength(MAX_KEYWORD_EDITS + MAX_EDITS);
	});

	it('requires every declared edit property for strict OpenAI JSON schema compatibility', () => {
		expect(TAILOR_SCHEMA.properties.edits.items.required).toEqual(['kind', 'targetId', 'text', 'bulletIndex']);
	});

	it('keeps a well-formed edit', () => {
		expect(validateEdits({ edits: [edit()] }, allowed)).toEqual([
			{ kind: 'add_bullet', targetId: 'w1', text: 'Shipped a thing.', bulletIndex: -1 },
		]);
	});

	// The model can invent an id that was never offered to it; those must not
	// silently become inserts against the wrong entry (or none at all).
	it('drops an edit whose target id was never offered', () => {
		expect(validateEdits({ edits: [edit({ targetId: 'nope' })] }, allowed)).toEqual([]);
	});

	it('drops a bullet edit aimed at a skill category id', () => {
		expect(validateEdits({ edits: [edit({ kind: 'add_bullet', targetId: 's1' })] }, allowed)).toEqual([]);
	});

	it('drops a skill edit aimed at an experience id', () => {
		expect(validateEdits({ edits: [edit({ kind: 'skill', targetId: 'w1', text: 'Go' })] }, allowed)).toEqual([]);
	});

	it('drops an unknown kind', () => {
		expect(validateEdits({ edits: [edit({ kind: 'profile' })] }, allowed)).toEqual([]);
	});

	it.each([[''], ['   '], [null], [42]])('drops an edit whose text is %p', (text) => {
		expect(validateEdits({ edits: [edit({ text })] }, allowed)).toEqual([]);
	});

	it('trims surrounding whitespace from the text', () => {
		expect(validateEdits({ edits: [edit({ text: '  Shipped a thing.  ' })] }, allowed)[0].text).toBe(
			'Shipped a thing.',
		);
	});

	it('drops duplicates of the same text on the same target', () => {
		expect(validateEdits({ edits: [edit(), edit()] }, allowed)).toHaveLength(1);
	});

	it('keeps the same text on two different targets', () => {
		expect(validateEdits({ edits: [edit(), edit({ targetId: 'p1' })] }, allowed)).toHaveLength(2);
	});

	it('caps runaway output at MAX_EDITS', () => {
		const many = Array.from({ length: MAX_EDITS + 15 }, (_, i) => edit({ text: `Bullet number ${i}.` }));
		expect(validateEdits({ edits: many }, allowed)).toHaveLength(MAX_EDITS);
	});

	it.each([[{}], [{ edits: null }], [{ edits: 'nope' }], [null], ['garbage']])(
		'returns an empty list for malformed payload %p',
		(raw) => {
			expect(validateEdits(raw, allowed)).toEqual([]);
		},
	);

	it('keeps good edits alongside bad ones rather than failing the batch', () => {
		const raw = { edits: [edit({ targetId: 'ghost' }), edit({ text: 'Real bullet.' })] };
		expect(validateEdits(raw, allowed)).toEqual([
			{ kind: 'add_bullet', targetId: 'w1', text: 'Real bullet.', bulletIndex: -1 },
		]);
	});
});

describe('buildTailorInput', () => {
	const occupation = {
		code: '15-1252.00',
		title: 'Software Developers',
		description: 'Design software.',
		brightOutlook: false,
		tasks: [{ id: 't1', text: 'Modify existing software.' }],
		detailedWorkActivities: [],
		technologySkills: [
			{
				category: 'IDEs',
				examples: [
					{ name: 'Git', hot: true },
					{ name: 'Splunk', hot: false },
				],
			},
		],
		skills: [{ id: 'k1', name: 'Programming', description: 'Writing programs.' }],
		knowledge: [],
		abilities: [],
		unavailable: [],
	} as OnetOccupation;

	it('lists unique occupation terms in category, example, skill, knowledge order', () => {
		const withDuplicates = {
			...occupation,
			technologySkills: [
				{
					category: 'IDEs',
					examples: [
						{ name: 'Git', hot: true },
						{ name: 'Splunk', hot: false },
					],
				},
				{ category: 'ides', examples: [{ name: 'Python', hot: false }] },
			],
			skills: [
				{ id: 's1', name: 'Programming', description: '' },
				{ id: 's2', name: 'SPLUNK', description: '' },
			],
			knowledge: [{ id: 'k1', name: 'Systems', description: '' }],
		};
		expect(occupationTerms(withDuplicates)).toEqual(['IDEs', 'Git', 'Splunk', 'Python', 'Programming', 'Systems']);
	});

	it('keeps the default prompt unchanged when keywords are disabled', () => {
		const original = buildTailorInput(resume(), occupation);
		const disabled = buildTailorInput(resume(), occupation, undefined, { keywords: false });
		expect(original.prompt).toBe(disabled.prompt);
		expect(original.prompt).not.toContain('HIDDEN KEYWORDS');
		expect(disabled.prompt).not.toContain('HIDDEN KEYWORDS');
		expect(original.allowed.keywords).toBeUndefined();
		expect(disabled.allowed.keywords).toBeUndefined();
	});

	it('offers grounded occupation terms when keywords are enabled', () => {
		const { prompt, allowed } = buildTailorInput(resume(), occupation, undefined, { keywords: true });
		expect(prompt).toContain('=== HIDDEN KEYWORDS ===');
		for (const term of occupationTerms(occupation)) expect(prompt).toContain(`- ${term}`);
		expect(allowed.keywords?.get('splunk')).toBe('Splunk');
		expect(allowed.visibleText).toContain('python');
		expect(prompt).toContain('targetId MUST be "keywords" and bulletIndex MUST be -1. Return at most 30.');
		expect(prompt).toContain('The 12-edit limit applies to non-keyword edits; up to 30 keyword edits are additional.');
	});

	function resume(): ResumeData {
		return {
			...structuredClone(defaultResumeData),
			workExperience: [
				{
					id: 'w1',
					title: 'Software Engineer',
					company: 'Acme',
					location: '',
					startDate: '',
					endDate: '',
					isPresent: true,
					bullets: ['Built an API.'],
				},
			],
			skills: [{ id: 's1', category: 'Languages', skills: 'Python' }],
		};
	}

	// The four font controls are always offered, so allowed.fields is never empty
	// and cannot be used to decide whether there is anything worth tailoring.
	it('reports no targets for a resume with nothing to tailor', () => {
		const bare = resume();
		bare.workExperience = [];
		bare.skills = [];
		bare.profile.summary = '';

		const empty = buildTailorInput(bare, occupation);
		expect(empty.hasTargets).toBe(false);
		expect(empty.allowed.fields?.size).toBe(4);
		expect(buildTailorInput(resume(), occupation).hasTargets).toBe(true);
	});

	it.each([
		['bullets', (r: ResumeData) => (r.skills = [])],
		['skills', (r: ResumeData) => (r.workExperience = [])],
	])('reports targets when only %s remain', (_label, strip) => {
		const r = resume();
		r.profile.summary = '';
		strip(r);
		expect(buildTailorInput(r, occupation).hasTargets).toBe(true);
	});

	it('offers every insertable target so the model can only choose a real one', () => {
		const { allowed: a } = buildTailorInput(resume(), occupation);
		expect([...a.bullets]).toEqual(['w1']);
		expect([...a.skills]).toEqual(['s1']);
	});

	it('offers profile, education, leadership, achievement, project stack, and font targets', () => {
		const r = resume();
		r.profile.summary = 'Software engineer.';
		r.education = [
			{
				id: 'e1',
				institution: 'University',
				location: '',
				degree: 'BS',
				major: '',
				concentration: '',
				minor: '',
				startDate: '',
				endDate: '',
				isPresent: false,
				bullets: [],
			},
		];
		r.leadership = [
			{
				id: 'l1',
				title: 'Lead',
				organization: 'Club',
				location: '',
				startDate: '',
				endDate: '',
				isPresent: false,
				bullets: [],
			},
		];
		r.projects[0] = { id: 'p1', name: 'Tool', stack: 'TypeScript', url: '', award: '', bullets: [] };
		r.achievements = [{ id: 'a1', title: 'Award', date: '', description: 'Recognized for impact.' }];
		const { allowed: a } = buildTailorInput(r, occupation);

		expect([...a.bullets]).toEqual(['w1', 'p1', 'e1', 'l1']);
		expect(a.fields).toEqual(
			new Set([
				'profile',
				'project-stack:p1',
				'achievement-description:a1',
				'baseSize',
				'nameSize',
				'headingSize',
				'contactSize',
			]),
		);
	});

	it('includes the resume evidence and the O*NET items in the prompt text', () => {
		const { prompt } = buildTailorInput(resume(), occupation);
		expect(prompt).toContain('Built an API.'); // existing bullet, so the model can ground its rewrite
		expect(prompt).toContain('Modify existing software.'); // O*NET task
		expect(prompt).toContain('Git'); // technology
		expect(prompt).toContain('w1'); // target id it must cite back
	});

	it('does not leak contact details into the prompt', () => {
		const r = resume();
		r.personalInfo.email = 'secret@example.com';
		r.personalInfo.phone = '555-0100';
		const { prompt } = buildTailorInput(r, occupation);
		expect(prompt).not.toContain('secret@example.com');
		expect(prompt).not.toContain('555-0100');
	});

	it('uses the compiled page count instead of the content estimate', () => {
		expect(buildTailorInput(resume(), occupation, 2).prompt).toContain('compiled document exceeds one page');

		const estimatedLong = resume();
		estimatedLong.workExperience[0].bullets = Array.from({ length: 60 }, () => 'A concise bullet.');
		expect(buildTailorInput(estimatedLong, occupation, 1).prompt).toContain('within the one-page target');
	});

	it.each([0, -1, 1.5, 101, null, '2'])('falls back to the estimate for invalid page count %p', (pageCount) => {
		const { prompt } = buildTailorInput(resume(), occupation, pageCount);
		expect(prompt).toContain('within the one-page target');
	});
});

describe('isValidCompiledPageCount', () => {
	it.each([1, 2, 100])('accepts bounded integer page count %p', (pageCount) => {
		expect(isValidCompiledPageCount(pageCount)).toBe(true);
	});

	it.each([0, -1, 1.5, 101, null, '2', undefined])('rejects invalid page count %p', (pageCount) => {
		expect(isValidCompiledPageCount(pageCount)).toBe(false);
	});
});

describe('isValidTailorResume', () => {
	it.each([
		['missing presentations', (resume: Record<string, unknown>) => delete resume.presentations],
		['malformed presentations', (resume: Record<string, unknown>) => (resume.presentations = [{}])],
		['missing custom sections', (resume: Record<string, unknown>) => delete resume.customSections],
		[
			'malformed custom sections',
			(resume: Record<string, unknown>) => (resume.customSections = [{ id: 's', heading: 'Service', entries: [{}] }]),
		],
		[
			'malformed publication extensions',
			(resume: Record<string, unknown>) =>
				(resume.publications = [
					{
						id: 'p',
						title: 'Paper',
						authors: '',
						venue: '',
						date: '',
						url: '',
						status: 3,
						volume: '',
						issue: '',
						pages: '',
						doi: '',
					},
				]),
		],
	])('rejects %s for keyword evidence serialization', (_label, change) => {
		const resume = structuredClone(defaultResumeData) as unknown as Record<string, unknown>;
		change(resume);
		expect(isValidTailorResume(resume, true)).toBe(false);
	});
	it('accepts the complete application resume shape', () => {
		expect(isValidTailorResume(structuredClone(defaultResumeData))).toBe(true);
		const withoutKeywords = structuredClone(defaultResumeData) as unknown as Record<string, unknown>;
		delete withoutKeywords.hiddenKeywords;
		expect(isValidTailorResume(withoutKeywords)).toBe(true);
	});

	it('rejects missing arrays before prompt construction', () => {
		const resume = structuredClone(defaultResumeData) as unknown as Record<string, unknown>;
		delete resume.education;
		expect(isValidTailorResume(resume)).toBe(false);
	});

	it('rejects malformed and oversized bullet fields', () => {
		const resume = structuredClone(defaultResumeData);
		resume.workExperience = [
			{
				id: 'w1',
				title: 'Engineer',
				company: 'Acme',
				location: '',
				startDate: '',
				endDate: '',
				isPresent: false,
				bullets: ['x'.repeat(12_001)],
			},
		];
		expect(isValidTailorResume(resume)).toBe(false);
	});
});

it.each([
	['skill', 's1', -1, MAX_SKILL_CHARS],
	['add_bullet', 'w1', -1, MAX_FIELD_CHARS],
	['rewrite_bullet', 'w1', 0, MAX_FIELD_CHARS],
	['rewrite_field', 'profile', -1, MAX_FIELD_CHARS],
])('bounds %s edit text', (kind, targetId, bulletIndex, limit) => {
	const targets = { ...allowed, fields: new Set(['profile']) };
	const item = edit({ kind, targetId, bulletIndex, text: 'x'.repeat(Number(limit)) });
	expect(validateEdits({ edits: [item] }, targets)).toHaveLength(1);
	expect(validateEdits({ edits: [{ ...item, text: item.text + 'x' }] }, targets)).toEqual([]);
});
