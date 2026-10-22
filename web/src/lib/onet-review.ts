import { applyTailorEdits } from './onet-apply';
import { withoutHiddenKeywords } from './hidden-keywords';
import { bulletTargets } from './onet-insert';
import type { TailorEdit } from './onet-types';
import type { ResumeData } from './types';

export interface TailorSuggestion {
	id: string;
	edit: TailorEdit;
	label: string;
	location: string;
	before: string;
	after: string;
}

/** In-memory snapshots only. Never persist a review or undo record. */
export interface TailorUndo {
	before: ResumeData;
	after: ResumeData;
}

// ResumeData is JSON data. Sort object keys so equivalent cloned objects do not
// become stale merely because their properties were inserted in another order.
function revision(data: ResumeData): string {
	return JSON.stringify(data, (_, value) =>
		value && typeof value === 'object' && !Array.isArray(value)
			? Object.fromEntries(
					Object.keys(value)
						.sort()
						.map((key) => [key, value[key]]),
				)
			: value,
	);
}

/** Compare complete resume values, ignoring object key order but preserving array order. */
export function sameRevision(a: ResumeData, b: ResumeData): boolean {
	return revision(a) === revision(b);
}

function snapshot(data: ResumeData): ResumeData {
	return JSON.parse(JSON.stringify(data));
}

function apply(data: ResumeData, edits: TailorEdit[]) {
	return applyTailorEdits(withoutHiddenKeywords(data), data, edits);
}

function describe(data: ResumeData, edit: TailorEdit): Omit<TailorSuggestion, 'id' | 'edit'> | null {
	const { kind, targetId, bulletIndex, text } = edit;
	if (!Number.isInteger(bulletIndex) || (kind !== 'remove_bullet' && !text.trim())) return null;
	if (kind !== 'rewrite_bullet' && kind !== 'remove_bullet' && bulletIndex !== -1) return null;
	if (kind === 'keyword') {
		return targetId === 'keywords'
			? { label: 'Add hidden keyword', location: 'Hidden keywords', before: '', after: text.trim() }
			: null;
	}
	if (kind === 'set_font') {
		const bounds = {
			baseSize: [6, 14],
			nameSize: [14, 32],
			headingSize: [10, 24],
			contactSize: [7, 16],
		};
		if (!Object.hasOwn(bounds, targetId)) return null;
		const key = targetId as keyof typeof bounds;
		const value = Number(text);
		const [min, max] = bounds[key];
		if (!Number.isFinite(value) || value < min || value > max) return null;
		const names = { baseSize: 'Body', nameSize: 'Name', headingSize: 'Heading', contactSize: 'Contact' };
		return {
			label: 'Change font size',
			location: `${names[key]} font`,
			before: `${data.fonts[key]} pt`,
			after: `${value} pt`,
		};
	}
	if (kind === 'skill') {
		const category = data.skills.find((entry) => entry.id === targetId);
		if (!category) return null;
		const next = apply(data, [edit]).data.skills.find((entry) => entry.id === targetId)!;
		return {
			label: 'Add skill',
			location: category.category || 'Untitled category',
			before: category.skills,
			after: next.skills,
		};
	}
	if (kind === 'rewrite_field') {
		if (targetId === 'profile')
			return { label: 'Rewrite field', location: 'Profile summary', before: data.profile.summary, after: text };
		const project = data.projects.find((entry) => targetId === `project-stack:${entry.id}`);
		if (project)
			return {
				label: 'Rewrite field',
				location: `${project.name || 'Untitled project'} · Stack`,
				before: project.stack,
				after: text,
			};
		const achievement = data.achievements.find((entry) => targetId === `achievement-description:${entry.id}`);
		return achievement
			? {
					label: 'Rewrite field',
					location: `${achievement.title || 'Untitled achievement'} · Description`,
					before: achievement.description,
					after: text,
				}
			: null;
	}
	const target = bulletTargets(data).find((entry) => entry.id === targetId);
	if (!target) return null;
	if (kind === 'add_bullet') return { label: 'Add bullet', location: target.label, before: '', after: text };
	if (kind !== 'rewrite_bullet' && kind !== 'remove_bullet') return null;
	const entry = [...data.workExperience, ...data.projects, ...data.education, ...data.leadership].find(
		(entry) => entry.id === targetId,
	)!;
	// Match the API payload and apply helper: blank strings are omitted, but
	// whitespace-only strings remain addressable. Preserve original array slots.
	const before = entry.bullets.filter(Boolean)[bulletIndex];
	if (bulletIndex < 0 || before === undefined) return null;
	return {
		label: kind === 'remove_bullet' ? 'Remove bullet' : 'Rewrite bullet',
		location: `${target.label} · Bullet ${bulletIndex + 1}`,
		before,
		after: kind === 'remove_bullet' ? '' : text,
	};
}

/** Stage validated server edits without changing either supplied resume. */
export function stageTailorReview(
	submitted: ResumeData,
	current: ResumeData,
	edits: TailorEdit[],
): { stale: boolean; suggestions: TailorSuggestion[] } {
	if (!sameRevision(submitted, current)) return { stale: true, suggestions: [] };
	const candidates = edits
		.map((edit, index) => ({ edit: { ...edit }, id: `tailor-${index}`, description: describe(current, edit) }))
		.filter((item) => item.description !== null);
	const removals = new Set(
		candidates
			.filter(({ edit }) => edit.kind === 'remove_bullet')
			.map(({ edit }) => JSON.stringify([edit.targetId, edit.bulletIndex])),
	);
	const suggestions: TailorSuggestion[] = [];
	const written = new Set<string>();
	let staged = current;
	for (const { edit, id, description } of candidates) {
		const bulletKey = JSON.stringify([edit.targetId, edit.bulletIndex]);
		if (edit.kind === 'rewrite_bullet' && removals.has(bulletKey)) continue;
		// First effective write wins for multiple competing replacements. Additions
		// remain independent and the apply helper handles their duplicate/cap rules.
		const writeKey = ['rewrite_bullet', 'remove_bullet', 'rewrite_field', 'set_font'].includes(edit.kind)
			? JSON.stringify([edit.kind, edit.targetId, edit.bulletIndex])
			: null;
		if (writeKey && written.has(writeKey)) continue;
		if (sameRevision(apply(current, [edit]).data, current)) continue;
		const next = apply(current, [...suggestions.map((item) => item.edit), edit]).data;
		if (sameRevision(next, staged)) continue;
		suggestions.push({ id, edit, ...description! });
		staged = next;
		if (writeKey) written.add(writeKey);
	}
	return { stale: false, suggestions };
}

export function applyTailorReview(
	submitted: ResumeData,
	current: ResumeData,
	suggestions: TailorSuggestion[],
	selectedIds: Iterable<string>,
) {
	const review = stageTailorReview(
		submitted,
		current,
		suggestions.map((item) => item.edit),
	);
	const empty = {
		data: current,
		paths: [] as string[],
		removed: 0,
		stale: review.stale,
		keywordsAdded: 0,
		applied: 0,
		undo: null as TailorUndo | null,
	};
	if (review.stale) return empty;
	const selected = new Set(selectedIds);
	const selectedEdits = new Set(
		suggestions.filter((item) => selected.has(item.id)).map((item) => JSON.stringify(item.edit)),
	);
	const edits = review.suggestions
		.filter((item) => selectedEdits.has(JSON.stringify(item.edit)))
		.map((item) => item.edit);
	if (!edits.length) return empty;
	const result = apply(current, edits);
	if (sameRevision(result.data, current)) return empty;
	return {
		...result,
		applied: edits.length,
		undo: { before: snapshot(current), after: snapshot(result.data) } as TailorUndo | null,
	};
}

/** Undo the entire acceptance only while its complete resulting revision is current. */
export function undoTailorReview(
	current: ResumeData,
	undo: TailorUndo,
): { data: ResumeData; stale: boolean; undone: boolean } {
	if (!sameRevision(current, undo.after)) return { data: current, stale: true, undone: false };
	return { data: snapshot(undo.before), stale: false, undone: true };
}
