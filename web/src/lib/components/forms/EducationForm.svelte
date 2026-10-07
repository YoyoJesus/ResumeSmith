<script lang="ts">
	import type { ResumeData } from '$lib/types';
	import { generateId } from '$lib/resume-utils';
	import { aiFilled, clearHighlight } from '$lib/ai-highlight';
	import { moveWithHighlights } from '$lib/reorder';
	import { DEGREES } from '$lib/degrees';
	import { MAJORS } from '$lib/majors';
	import { institutionsList, locationsList } from '$lib/suggestion-state.svelte';
	import EntryCard from '../EntryCard.svelte';
	import DateRange from '../DateRange.svelte';
	import BulletEditor from '../BulletEditor.svelte';
	import ComboBox from '../ComboBox.svelte';

	let { data }: { data: ResumeData } = $props();

	function addEducation() {
		data.education = [
			...data.education,
			{
				id: generateId(),
				institution: '',
				location: '',
				degree: '',
				major: '',
				concentration: '',
				minor: '',
				startDate: '',
				endDate: '',
				isPresent: false,
				bullets: [''],
			},
		];
	}
	function removeEducation(id: string) {
		data.education = data.education.filter((e) => e.id !== id);
	}
	const uid = $props.id();
</script>

<div class="editor-form">
	<div class="editor-heading">
		<h2>Education</h2>
		<button class="primary editor-add" onclick={addEducation}>+ Add education</button>
	</div>
	{#each data.education as edu, i (edu.id)}
		<EntryCard
			index={i}
			count={data.education.length}
			label={`education entry ${i + 1}`}
			onMove={(direction) => (data.education = moveWithHighlights(data.education, 'education', i, direction))}
			onRemove={() => removeEducation(edu.id)}
		>
			<div class="editor-grid">
				<div>
					<label for={`${uid}-${i}-institution`}>Institution</label>
					<ComboBox
						id={`${uid}-${i}-institution`}
						bind:value={edu.institution}
						options={institutionsList.items}
						placeholder="University Name"
						highlighted={aiFilled.has(`education.${i}.institution`)}
						oninput={() => clearHighlight(`education.${i}.institution`)}
						onfocus={institutionsList.ensureLoaded}
					/>
				</div>
				<div>
					<label for={`${uid}-${i}-location`}>Location</label>
					<ComboBox
						id={`${uid}-${i}-location`}
						bind:value={edu.location}
						options={locationsList.items}
						placeholder="City, State"
						highlighted={aiFilled.has(`education.${i}.location`)}
						oninput={() => clearHighlight(`education.${i}.location`)}
						onfocus={locationsList.ensureLoaded}
					/>
				</div>
				<div>
					<label for={`${uid}-${i}-degree`}>Degree</label>
					<ComboBox
						id={`${uid}-${i}-degree`}
						bind:value={edu.degree}
						options={DEGREES}
						placeholder="Bachelor of Science"
						highlighted={aiFilled.has(`education.${i}.degree`)}
						oninput={() => clearHighlight(`education.${i}.degree`)}
					/>
				</div>
				<div>
					<label for={`${uid}-${i}-major`}>Major</label>
					<ComboBox
						id={`${uid}-${i}-major`}
						bind:value={edu.major}
						options={MAJORS}
						placeholder="Computer Science"
						highlighted={aiFilled.has(`education.${i}.major`)}
						oninput={() => clearHighlight(`education.${i}.major`)}
					/>
				</div>
				<div>
					<label for={`${uid}-${i}-concentration`}>Concentration (optional)</label>
					<input
						id={`${uid}-${i}-concentration`}
						type="text"
						bind:value={edu.concentration}
						placeholder="Artificial Intelligence"
						class:ai-filled={aiFilled.has(`education.${i}.concentration`)}
						oninput={() => clearHighlight(`education.${i}.concentration`)}
					/>
				</div>
				<div>
					<label for={`${uid}-${i}-minor`}>Minor (optional)</label>
					<ComboBox
						id={`${uid}-${i}-minor`}
						bind:value={edu.minor}
						options={MAJORS}
						placeholder="Mathematics"
						highlighted={aiFilled.has(`education.${i}.minor`)}
						oninput={() => clearHighlight(`education.${i}.minor`)}
					/>
				</div>
				<DateRange
					bind:startDate={edu.startDate}
					bind:endDate={edu.endDate}
					bind:isPresent={edu.isPresent}
					path={`education.${i}`}
					endLabel="End Date (Expected)"
					presentLabel="Currently studying"
				/>
			</div>
			<BulletEditor
				bind:bullets={edu.bullets}
				label="Honors/GPA"
				path={`education.${i}.bullets`}
				placeholder="Relevant coursework, honors, GPA..."
			/>
		</EntryCard>
	{/each}
	{#if data.education.length === 0}<p class="editor-empty">No education added yet.</p>{/if}
</div>
