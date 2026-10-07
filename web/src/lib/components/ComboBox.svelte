<script lang="ts">
	import { filterOptions } from '$lib/combo-filter';

	interface ComboBoxProps {
		value?: string;
		id: string;
		options: readonly string[];
		placeholder?: string;
		highlighted?: boolean;
		oninput?: () => void;
		onfocus?: () => void;
	}

	let {
		value = $bindable(''),
		id,
		options = [],
		placeholder = '',
		highlighted = false,
		oninput,
		onfocus,
	}: ComboBoxProps = $props();

	let isOpen = $state(false);
	let activeIndex = $state(-1);

	const suggestions = $derived(filterOptions(options, value ?? '', 8));
	const exactOnly = $derived(suggestions.length === 1 && suggestions[0].trim() === (value ?? '').trim());
	const canOpen = $derived(suggestions.length > 0 && !exactOnly);
	const isExpanded = $derived(isOpen && canOpen);

	const listboxId = $derived(`${id}-listbox`);
	const activeDescendantId = $derived(
		isExpanded && activeIndex >= 0 && activeIndex < suggestions.length ? `${id}-option-${activeIndex}` : undefined,
	);

	$effect(() => {
		if (isExpanded && activeIndex >= 0) {
			const el = document.getElementById(`${id}-option-${activeIndex}`);
			el?.scrollIntoView?.({ block: 'nearest' });
		}
	});

	function selectOption(option: string) {
		value = option;
		isOpen = false;
		activeIndex = -1;
		oninput?.();
	}

	function handleInput(event: Event & { currentTarget: HTMLInputElement }) {
		value = event.currentTarget.value;
		activeIndex = -1;
		isOpen = true;
		oninput?.();
	}

	function handleFocus() {
		onfocus?.();
	}

	function handleBlur() {
		isOpen = false;
		activeIndex = -1;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown') {
			if (!isExpanded) {
				if (canOpen) {
					event.preventDefault();
					isOpen = true;
					activeIndex = 0;
				}
			} else {
				event.preventDefault();
				if (suggestions.length > 0) {
					activeIndex = activeIndex < 0 ? 0 : (activeIndex + 1) % suggestions.length;
				}
			}
		} else if (event.key === 'ArrowUp') {
			if (!isExpanded) {
				if (canOpen) {
					event.preventDefault();
					isOpen = true;
					activeIndex = suggestions.length - 1;
				}
			} else {
				event.preventDefault();
				if (suggestions.length > 0) {
					activeIndex =
						activeIndex < 0 ? suggestions.length - 1 : (activeIndex - 1 + suggestions.length) % suggestions.length;
				}
			}
		} else if (event.key === 'Enter') {
			if (isExpanded && activeIndex >= 0 && activeIndex < suggestions.length) {
				event.preventDefault();
				selectOption(suggestions[activeIndex]);
			}
		} else if (event.key === 'Escape') {
			if (isExpanded) {
				event.preventDefault();
				isOpen = false;
				activeIndex = -1;
			}
		}
	}
</script>

<div class="combobox-wrapper">
	<input
		{id}
		type="text"
		role="combobox"
		aria-autocomplete="list"
		aria-expanded={isExpanded}
		aria-controls={listboxId}
		aria-activedescendant={activeDescendantId}
		autocomplete="off"
		{placeholder}
		bind:value
		class:ai-filled={highlighted}
		oninput={handleInput}
		onfocus={handleFocus}
		onblur={handleBlur}
		onkeydown={handleKeydown}
	/>
	{#if isExpanded}
		<ul id={listboxId} role="listbox" class="combobox-listbox">
			{#each suggestions as option, i (option)}
				<li
					id={`${id}-option-${i}`}
					role="option"
					aria-selected={activeIndex === i}
					class="combobox-option"
					class:active={activeIndex === i}
					onmousedown={(e) => {
						e.preventDefault();
						selectOption(option);
					}}
					onmouseenter={() => {
						activeIndex = i;
					}}
				>
					{option}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.combobox-wrapper {
		position: relative;
		width: 100%;
	}

	.combobox-listbox {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		z-index: 50;
		margin-top: 0.25rem;
		max-height: 15rem;
		overflow-y: auto;
		border-radius: 0.375rem;
		border: 1px solid var(--color-gray-300, #d1d5db);
		background-color: white;
		box-shadow:
			0 4px 6px -1px rgb(0 0 0 / 0.1),
			0 2px 4px -2px rgb(0 0 0 / 0.1);
		padding: 0.25rem 0;
		list-style: none;
	}

	.combobox-option {
		cursor: pointer;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		line-height: 1.25rem;
		color: var(--color-gray-900, #111827);
		user-select: none;
	}

	.combobox-option:hover,
	.combobox-option.active,
	.combobox-option[aria-selected='true'] {
		background-color: #2563eb;
		color: white;
	}
</style>
