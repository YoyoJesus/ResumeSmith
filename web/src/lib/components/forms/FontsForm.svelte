<script lang="ts">
	import type { FontSettings, ResumeData } from '$lib/types';
	import { defaultFontFamilies, defaultFontSettings } from '$lib/types';
	import { DEFAULT_FONT_FAMILY, FONT_OPTIONS, FONT_SIZE_BOUNDS, FONT_SIZE_STEP, stepFontSize } from '$lib/fonts';

	let { data }: { data: ResumeData } = $props();

	const SIZES: { key: keyof FontSettings; label: string; hint: string }[] = [
		{ key: 'baseSize', label: 'Base Text Size', hint: 'Body text, bullet points' },
		{ key: 'nameSize', label: 'Name Size', hint: 'Your name at the top' },
		{ key: 'headingSize', label: 'Section Heading Size', hint: 'Education, Experience, etc.' },
		{ key: 'contactSize', label: 'Contact Info Size', hint: 'Email, phone, links' },
	];

	function resetFontSettings() {
		data.fonts = { ...defaultFontSettings };
		data.fontFamilies = { ...defaultFontFamilies };
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<h2 class="text-lg font-semibold">Font Settings</h2>
		<button class="secondary text-sm" onclick={resetFontSettings}>Reset to Default</button>
	</div>

	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<div>
			<label for="heading-font">Heading Font</label>
			<select id="heading-font" bind:value={data.fontFamilies.heading}>
				{#each FONT_OPTIONS as option (option.family)}
					<option value={option.family}
						>{option.family}{option.family === DEFAULT_FONT_FAMILY ? ' (default)' : ''}</option
					>
				{/each}
			</select>
			<p class="text-xs text-gray-500 mt-1">Your name and section headings</p>
		</div>
		<div>
			<label for="body-font">Body Font</label>
			<select id="body-font" bind:value={data.fontFamilies.body}>
				{#each FONT_OPTIONS as option (option.family)}
					<option value={option.family}
						>{option.family}{option.family === DEFAULT_FONT_FAMILY ? ' (default)' : ''}</option
					>
				{/each}
			</select>
			<p class="text-xs text-gray-500 mt-1">Entries, bullets, and contact info</p>
		</div>
	</div>
	<p class="text-xs text-gray-500">Custom templates keep their own fonts.</p>

	<p class="text-sm text-gray-600">Sizes are in points (pt).</p>
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		{#each SIZES as size (size.key)}
			{@const [min, max] = FONT_SIZE_BOUNDS[size.key]}
			<div>
				<label for={`font-${size.key}`}>{size.label}</label>
				<div class="flex items-center gap-2">
					<input
						id={`font-${size.key}`}
						type="range"
						{min}
						{max}
						step="0.1"
						bind:value={data.fonts[size.key]}
						class="flex-1"
					/>
					<button
						class="secondary px-2 py-0.5 text-sm"
						onclick={() => (data.fonts[size.key] = stepFontSize(data.fonts[size.key], -FONT_SIZE_STEP, size.key))}
						disabled={data.fonts[size.key] <= min}
						aria-label={`Decrease ${size.label.toLowerCase()} by ${FONT_SIZE_STEP} pt`}>-</button
					>
					<span class="text-sm font-mono w-14 text-center">{data.fonts[size.key]}pt</span>
					<button
						class="secondary px-2 py-0.5 text-sm"
						onclick={() => (data.fonts[size.key] = stepFontSize(data.fonts[size.key], FONT_SIZE_STEP, size.key))}
						disabled={data.fonts[size.key] >= max}
						aria-label={`Increase ${size.label.toLowerCase()} by ${FONT_SIZE_STEP} pt`}>+</button
					>
				</div>
				<p class="text-xs text-gray-500 mt-1">{size.hint}</p>
			</div>
		{/each}
	</div>
</div>
