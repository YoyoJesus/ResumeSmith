<script lang="ts">
	import type { ResumeData } from '$lib/types';
	import { generateId } from '$lib/resume-utils';
	import { aiFilled, clearHighlight } from '$lib/ai-highlight';

	let { data }: { data: ResumeData } = $props();

	function addPublication() {
		data.publications = [
			...data.publications,
			{ id: generateId(), title: '', authors: '', venue: '', date: '', url: '' },
		];
	}
	function removePublication(id: string) {
		data.publications = data.publications.filter((p) => p.id !== id);
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold">Publications</h2>
		<button class="primary text-sm" onclick={addPublication}>+ Add publication</button>
	</div>
	{#each data.publications as publication, i}
		<div class="border rounded-lg p-4 space-y-3 bg-gray-50">
			<div class="flex justify-between items-start gap-2">
				<div class="flex-1">
					<label>Title</label><input
						type="text"
						bind:value={publication.title}
						placeholder="Efficient Parsing of Structured Documents"
						class:ai-filled={aiFilled.has(`publications.${i}.title`)}
						oninput={() => clearHighlight(`publications.${i}.title`)}
					/>
				</div>
				<button class="danger text-sm px-2 py-1 mt-6" onclick={() => removePublication(publication.id)}>Remove</button>
			</div>
			<div class="grid grid-cols-1 md:grid-cols-2 gap-3">
				<div>
					<label>Authors</label><input
						type="text"
						bind:value={publication.authors}
						placeholder="J. Doe, A. Smith"
						class:ai-filled={aiFilled.has(`publications.${i}.authors`)}
						oninput={() => clearHighlight(`publications.${i}.authors`)}
					/>
				</div>
				<div>
					<label>Journal or Conference</label><input
						type="text"
						bind:value={publication.venue}
						placeholder="Proceedings of Example Conf"
						class:ai-filled={aiFilled.has(`publications.${i}.venue`)}
						oninput={() => clearHighlight(`publications.${i}.venue`)}
					/>
				</div>
				<div>
					<label>Date</label><input
						type="month"
						bind:value={publication.date}
						class:ai-filled={aiFilled.has(`publications.${i}.date`)}
						oninput={() => clearHighlight(`publications.${i}.date`)}
					/>
				</div>
				<div>
					<label>Link</label><input
						type="text"
						bind:value={publication.url}
						placeholder="doi.org/10.1234/example"
						class:ai-filled={aiFilled.has(`publications.${i}.url`)}
						oninput={() => clearHighlight(`publications.${i}.url`)}
					/>
				</div>
			</div>
		</div>
	{/each}
	{#if data.publications.length === 0}<p class="text-gray-500 text-center py-8">No publications added yet.</p>{/if}
</div>
