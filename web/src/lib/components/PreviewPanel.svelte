<script lang="ts">
	import { tick } from 'svelte';
	import type { CompiledPreview } from '$lib/pdf-compiler';
	import PaginatedPreview from './PaginatedPreview.svelte';
	import type { PreviewZoom } from '$lib/preview-zoom';

	let {
		showCode,
		typstCode,
		preview,
		isPreviewLoading,
		documentLabel,
	}: {
		showCode: boolean;
		typstCode: string;
		preview: CompiledPreview | null;
		isPreviewLoading: boolean;
		documentLabel: string;
	} = $props();

	let copied = $state(false);
	let pageIndex = $state(0);
	let zoom = $state<PreviewZoom>('page');
	let fullscreenOpen = $state(false);
	let fullscreenDialog: HTMLDialogElement;
	const componentId = $props.id();
	const fullscreenTitleId = `${componentId}-fullscreen-title`;
	let copiedTimer: ReturnType<typeof setTimeout> | undefined;

	async function openFullscreen() {
		fullscreenOpen = true;
		await tick();
		fullscreenDialog.showModal();
	}

	$effect(() => {
		if (showCode) fullscreenDialog?.close();
	});

	$effect(() => {
		if (!fullscreenOpen) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});

	async function copyToClipboard() {
		await navigator.clipboard.writeText(typstCode);
		copied = true;
		clearTimeout(copiedTimer);
		copiedTimer = setTimeout(() => (copied = false), 1500);
	}
</script>

<div
	class="flex h-[calc(100vh-10rem)] flex-col items-center overflow-hidden rounded-lg bg-gray-500 p-4 shadow lg:h-full"
>
	<h2 class="text-lg font-semibold mb-4 text-white">
		{showCode
			? 'Typst Code'
			: `${documentLabel} Preview${preview ? ` · ${preview.pages.length} ${preview.pages.length === 1 ? 'page' : 'pages'}` : ''}`}
	</h2>

	{#if showCode}
		<div class="relative min-h-0 w-full flex-1">
			<button class="absolute top-2 right-2 secondary text-xs" onclick={copyToClipboard}
				>{copied ? 'Copied' : 'Copy'}</button
			>
			<pre class="h-full w-full overflow-auto rounded-lg bg-gray-900 p-4 text-xs text-gray-100"><code>{typstCode}</code
				></pre>
		</div>
	{:else}
		<div class="flex min-h-0 w-full flex-1 justify-center">
			{#if isPreviewLoading && !preview}
				<div class="flex items-center justify-center h-full text-gray-400">
					<span>Compiling preview...</span>
				</div>
			{:else if preview}
				<PaginatedPreview {preview} {documentLabel} bind:pageIndex bind:zoom onexpand={openFullscreen} />
			{:else}
				<div class="flex items-center justify-center h-full text-gray-400">
					<span>Preview will appear here</span>
				</div>
			{/if}
		</div>
	{/if}
</div>

<dialog
	bind:this={fullscreenDialog}
	aria-labelledby={fullscreenTitleId}
	class="m-auto h-[calc(100dvh-2rem)] max-h-none w-[calc(100vw-2rem)] max-w-none rounded-lg border-0 bg-gray-500 p-4 shadow-xl backdrop:bg-black/60"
	onclose={() => (fullscreenOpen = false)}
>
	{#if fullscreenOpen}
		<div class="flex h-full min-h-0 flex-col gap-4">
			<div class="flex items-center justify-between gap-3">
				<h2 id={fullscreenTitleId} class="text-lg font-semibold text-white">{documentLabel} Preview</h2>
				<button type="button" class="secondary" onclick={() => fullscreenDialog.close()}
					>Close fullscreen preview</button
				>
			</div>
			<div class="min-h-0 flex-1">
				{#if preview}
					<PaginatedPreview {preview} {documentLabel} bind:pageIndex bind:zoom expanded />
				{:else}
					<p class="text-center text-white">{isPreviewLoading ? 'Compiling preview...' : 'Preview will appear here'}</p>
				{/if}
			</div>
		</div>
	{/if}
</dialog>
