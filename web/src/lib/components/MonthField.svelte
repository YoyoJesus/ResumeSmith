<script lang="ts">
	import { untrack } from 'svelte';
	import { joinYearMonth, MONTHS, splitYearMonth } from '$lib/year-month';

	let {
		value = $bindable(''),
		id,
		label,
		disabled = false,
		highlighted = false,
		oninput,
	}: {
		value?: string;
		id?: string;
		label: string;
		disabled?: boolean;
		highlighted?: boolean;
		oninput?: () => void;
	} = $props();

	const initial = splitYearMonth(value ?? '');
	let localYear = $state(initial.year);
	let localMonth = $state(initial.month);

	$effect(() => {
		const currentProp = value ?? '';
		if (currentProp !== untrack(() => joinYearMonth(localYear, localMonth))) {
			const parsed = splitYearMonth(currentProp);
			localYear = parsed.year;
			localMonth = parsed.month;
		}
	});

	function handleMonthChange(event: Event) {
		const target = event.currentTarget as HTMLSelectElement;
		localMonth = target.value;
		value = joinYearMonth(localYear, localMonth);
		oninput?.();
	}

	function handleYearInput(event: Event) {
		const target = event.currentTarget as HTMLInputElement;
		const cleaned = target.value.replace(/\D/g, '').slice(0, 4);
		if (target.value !== cleaned) {
			target.value = cleaned;
		}
		localYear = cleaned;
		value = joinYearMonth(localYear, localMonth);
		oninput?.();
	}
</script>

<div role="group" aria-label={label} class="month-field">
	<select {id} value={localMonth} {disabled} class:ai-filled={highlighted} onchange={handleMonthChange}>
		<option value="">Month</option>
		{#each MONTHS as { value: mVal, label: mLabel }}
			<option value={mVal}>{mLabel}</option>
		{/each}
	</select>
	<input
		type="text"
		inputmode="numeric"
		maxlength="4"
		placeholder="YYYY"
		aria-label={`${label} year`}
		value={localYear}
		{disabled}
		class:ai-filled={highlighted}
		oninput={handleYearInput}
	/>
</div>

<style>
	.month-field {
		display: flex;
		gap: 0.5rem;
		width: 100%;
	}

	.month-field select {
		flex: 1 1 0%;
		min-width: 0;
	}

	.month-field input {
		width: 5.5rem;
		flex: 0 0 5.5rem;
	}
</style>
