import type { OnetOccupationRef } from './onet-types';

export const GENERIC_ONET_ERROR = "Can't reach O*NET. Check your connection and retry.";

export interface OnetSearchCallbacks {
	onStart: () => void;
	onResult: (occupations: OnetOccupationRef[]) => void;
	onError: (error: string) => void;
	onCleared: () => void;
	onSettled: () => void;
}

/** Fetches occupation search results from the /api/onet/search endpoint. */
export async function fetchOnetOccupations(
	keyword: string,
	signal?: AbortSignal,
	fetchFn: typeof fetch = fetch,
): Promise<OnetOccupationRef[]> {
	const res = await fetchFn(`/api/onet/search?keyword=${encodeURIComponent(keyword)}`, { signal });
	if (!res.ok) {
		let message = GENERIC_ONET_ERROR;
		try {
			const body = await res.json();
			if (body?.error?.message) {
				message = body.error.message;
			}
		} catch {
			// keep GENERIC_ONET_ERROR
		}
		throw new Error(message);
	}
	const data = await res.json();
	return (data?.occupations as OnetOccupationRef[]) ?? [];
}

/**
 * Creates a debounced and race-condition-safe search scheduler for O*NET occupations.
 * Guarantees that only the latest request generation can mutate search state,
 * and cancels/invalidates obsolete requests immediately upon clearing or newer searches.
 */
export function createOnetSearchScheduler(
	search: (keyword: string, signal: AbortSignal) => Promise<OnetOccupationRef[]>,
	callbacks: OnetSearchCallbacks,
	delayMs = 300,
) {
	let generation = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;
	let controller: AbortController | null = null;

	function cancelPending() {
		clearTimeout(timer);
		timer = undefined;
		if (controller) {
			controller.abort();
			controller = null;
		}
		generation += 1;
	}

	async function execute(keyword: string, request: number) {
		const currentController = new AbortController();
		controller = currentController;
		callbacks.onStart();

		try {
			const occupations = await search(keyword, currentController.signal);
			if (request === generation) {
				callbacks.onResult(occupations);
			}
		} catch (error) {
			if (currentController.signal.aborted || request !== generation) {
				return;
			}
			const message = error instanceof Error && error.message ? error.message : GENERIC_ONET_ERROR;
			callbacks.onError(message);
		} finally {
			if (request === generation) {
				if (controller === currentController) {
					controller = null;
				}
				callbacks.onSettled();
			}
		}
	}

	return {
		/** Schedules a debounced search. Clears immediately if keyword is empty or whitespace. */
		schedule(keyword: string) {
			cancelPending();
			const trimmed = keyword.trim();
			if (!trimmed) {
				callbacks.onCleared();
				callbacks.onSettled();
				return;
			}
			const request = generation;
			timer = setTimeout(() => {
				void execute(trimmed, request);
			}, delayMs);
		},

		/** Runs search immediately without debounce delay. */
		searchImmediately(keyword: string) {
			cancelPending();
			const trimmed = keyword.trim();
			if (!trimmed) {
				callbacks.onCleared();
				callbacks.onSettled();
				return;
			}
			const request = generation;
			void execute(trimmed, request);
		},

		/** Cancels pending timers, aborts in-flight requests, and settles state. */
		cancel() {
			cancelPending();
			callbacks.onSettled();
		},

		/** Invalidate and clear search state. */
		clear() {
			cancelPending();
			callbacks.onCleared();
			callbacks.onSettled();
		},
	};
}
