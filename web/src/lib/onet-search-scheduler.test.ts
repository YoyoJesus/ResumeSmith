import { afterEach, describe, expect, it, vi } from 'vitest';
import type { OnetOccupationRef } from './onet-types';
import {
	createOnetSearchScheduler,
	fetchOnetOccupations,
	GENERIC_ONET_ERROR,
	type OnetSearchCallbacks,
} from './onet-search-scheduler';

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

const SAMPLE_A: OnetOccupationRef[] = [{ code: '15-1252.00', title: 'Software Developers', brightOutlook: true }];
const SAMPLE_B: OnetOccupationRef[] = [{ code: '29-1141.00', title: 'Registered Nurses', brightOutlook: true }];

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe('createOnetSearchScheduler', () => {
	it('executes a debounced search and notifies callbacks upon completion', async () => {
		vi.useFakeTimers();
		const search = vi.fn().mockResolvedValue(SAMPLE_A);
		const onStart = vi.fn();
		const onResult = vi.fn();
		const onError = vi.fn();
		const onCleared = vi.fn();
		const onSettled = vi.fn();

		const scheduler = createOnetSearchScheduler(search, { onStart, onResult, onError, onCleared, onSettled }, 300);

		scheduler.schedule('software');
		expect(search).not.toHaveBeenCalled();
		expect(onStart).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(300);
		expect(search).toHaveBeenCalledWith('software', expect.any(AbortSignal));
		expect(onStart).toHaveBeenCalledOnce();
		expect(onResult).toHaveBeenCalledWith(SAMPLE_A);
		expect(onSettled).toHaveBeenCalledOnce();
		expect(onError).not.toHaveBeenCalled();
	});

	it('Case 1: ignores an older request that resolves after a newer request', async () => {
		vi.useFakeTimers();
		const first = deferred<OnetOccupationRef[]>();
		const second = deferred<OnetOccupationRef[]>();

		const search = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
		const onStart = vi.fn();
		const onResult = vi.fn();
		const onError = vi.fn();
		const onCleared = vi.fn();
		const onSettled = vi.fn();

		const scheduler = createOnetSearchScheduler(search, { onStart, onResult, onError, onCleared, onSettled }, 300);

		// Start request A
		scheduler.schedule('query A');
		await vi.advanceTimersByTimeAsync(300);
		expect(search).toHaveBeenCalledWith('query A', expect.any(AbortSignal));
		expect(onStart).toHaveBeenCalledTimes(1);

		// Start request B
		scheduler.schedule('query B');
		await vi.advanceTimersByTimeAsync(300);
		expect(search).toHaveBeenCalledWith('query B', expect.any(AbortSignal));
		expect(onStart).toHaveBeenCalledTimes(2);

		// Request B completes first
		second.resolve(SAMPLE_B);
		await Promise.resolve();
		expect(onResult).toHaveBeenCalledTimes(1);
		expect(onResult).toHaveBeenLastCalledWith(SAMPLE_B);
		expect(onSettled).toHaveBeenCalledTimes(1);

		// Request A completes later (out-of-order)
		first.resolve(SAMPLE_A);
		await Promise.resolve();

		// Request A MUST NOT overwrite Request B or trigger callbacks again
		expect(onResult).toHaveBeenCalledTimes(1);
		expect(onResult).toHaveBeenLastCalledWith(SAMPLE_B);
		expect(onSettled).toHaveBeenCalledTimes(1);
		expect(onError).not.toHaveBeenCalled();
	});

	it('Case 2: ignores a delayed request that resolves after the query is cleared', async () => {
		vi.useFakeTimers();
		const first = deferred<OnetOccupationRef[]>();

		const search = vi.fn().mockReturnValue(first.promise);
		const onStart = vi.fn();
		const onResult = vi.fn();
		const onError = vi.fn();
		const onCleared = vi.fn();
		const onSettled = vi.fn();

		const scheduler = createOnetSearchScheduler(search, { onStart, onResult, onError, onCleared, onSettled }, 300);

		// Start request A
		scheduler.schedule('query A');
		await vi.advanceTimersByTimeAsync(300);
		expect(search).toHaveBeenCalledWith('query A', expect.any(AbortSignal));
		expect(onStart).toHaveBeenCalledOnce();

		// User clears search input
		scheduler.schedule('');
		expect(onCleared).toHaveBeenCalledOnce();
		expect(onSettled).toHaveBeenCalledOnce();

		// Request A resolves later
		first.resolve(SAMPLE_A);
		await Promise.resolve();

		// Old response must not restore results or call callbacks
		expect(onResult).not.toHaveBeenCalled();
		expect(onSettled).toHaveBeenCalledOnce(); // Only the clear called it
		expect(onError).not.toHaveBeenCalled();
	});

	it('cancels pending debounce when cleared before timer fires', async () => {
		vi.useFakeTimers();
		const search = vi.fn();
		const onCleared = vi.fn();
		const onSettled = vi.fn();

		const scheduler = createOnetSearchScheduler(
			search,
			{ onStart: vi.fn(), onResult: vi.fn(), onError: vi.fn(), onCleared, onSettled },
			300,
		);

		scheduler.schedule('typing');
		await vi.advanceTimersByTimeAsync(150);
		scheduler.schedule('   ');

		expect(onCleared).toHaveBeenCalledOnce();
		expect(onSettled).toHaveBeenCalledOnce();

		await vi.advanceTimersByTimeAsync(300);
		expect(search).not.toHaveBeenCalled();
	});

	it('ignores errors from stale/older requests when a newer request is in flight', async () => {
		vi.useFakeTimers();
		const first = deferred<OnetOccupationRef[]>();
		const second = deferred<OnetOccupationRef[]>();

		const search = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
		const onResult = vi.fn();
		const onError = vi.fn();
		const onSettled = vi.fn();

		const scheduler = createOnetSearchScheduler(
			search,
			{ onStart: vi.fn(), onResult, onError, onCleared: vi.fn(), onSettled },
			300,
		);

		scheduler.schedule('query A');
		await vi.advanceTimersByTimeAsync(300);

		scheduler.schedule('query B');
		await vi.advanceTimersByTimeAsync(300);

		// Older request fails
		first.reject(new Error('500 Internal Server Error'));
		await Promise.resolve();

		// Error should be ignored because request A is stale
		expect(onError).not.toHaveBeenCalled();
		expect(onSettled).not.toHaveBeenCalled();

		// Newer request succeeds
		second.resolve(SAMPLE_B);
		await Promise.resolve();

		expect(onResult).toHaveBeenCalledWith(SAMPLE_B);
		expect(onSettled).toHaveBeenCalledOnce();
		expect(onError).not.toHaveBeenCalled();
	});

	it('propagates error when the current request fails', async () => {
		vi.useFakeTimers();
		const search = vi.fn().mockRejectedValue(new Error('Rate limit exceeded'));
		const onError = vi.fn();
		const onSettled = vi.fn();

		const scheduler = createOnetSearchScheduler(
			search,
			{ onStart: vi.fn(), onResult: vi.fn(), onError, onCleared: vi.fn(), onSettled },
			300,
		);

		scheduler.schedule('query A');
		await vi.advanceTimersByTimeAsync(300);

		expect(onError).toHaveBeenCalledWith('Rate limit exceeded');
		expect(onSettled).toHaveBeenCalledOnce();
	});

	it('aborts previous in-flight request signal when new search starts', async () => {
		vi.useFakeTimers();
		let firstSignal!: AbortSignal;
		let secondSignal!: AbortSignal;

		const first = deferred<OnetOccupationRef[]>();
		const second = deferred<OnetOccupationRef[]>();

		const search = vi
			.fn()
			.mockImplementationOnce((_, signal: AbortSignal) => {
				firstSignal = signal;
				return first.promise;
			})
			.mockImplementationOnce((_, signal: AbortSignal) => {
				secondSignal = signal;
				return second.promise;
			});

		const scheduler = createOnetSearchScheduler(
			search,
			{ onStart: vi.fn(), onResult: vi.fn(), onError: vi.fn(), onCleared: vi.fn(), onSettled: vi.fn() },
			300,
		);

		scheduler.schedule('query A');
		await vi.advanceTimersByTimeAsync(300);
		expect(firstSignal.aborted).toBe(false);

		scheduler.schedule('query B');
		await vi.advanceTimersByTimeAsync(300);
		expect(firstSignal.aborted).toBe(true);
		expect(secondSignal.aborted).toBe(false);
	});

	it('supports searchImmediately bypassing debounce delay', async () => {
		const search = vi.fn().mockResolvedValue(SAMPLE_A);
		const onResult = vi.fn();
		const onSettled = vi.fn();

		const scheduler = createOnetSearchScheduler(
			search,
			{ onStart: vi.fn(), onResult, onError: vi.fn(), onCleared: vi.fn(), onSettled },
			300,
		);

		scheduler.searchImmediately('immediate');
		expect(search).toHaveBeenCalledWith('immediate', expect.any(AbortSignal));

		await Promise.resolve();
		expect(onResult).toHaveBeenCalledWith(SAMPLE_A);
		expect(onSettled).toHaveBeenCalledOnce();
	});

	it('cancel() aborts pending work and ignores in-flight results', async () => {
		const first = deferred<OnetOccupationRef[]>();
		const search = vi.fn().mockReturnValue(first.promise);
		const onResult = vi.fn();
		const onSettled = vi.fn();

		const scheduler = createOnetSearchScheduler(
			search,
			{ onStart: vi.fn(), onResult, onError: vi.fn(), onCleared: vi.fn(), onSettled },
			300,
		);

		scheduler.searchImmediately('cancel test');
		scheduler.cancel();
		expect(onSettled).toHaveBeenCalledOnce();

		first.resolve(SAMPLE_A);
		await Promise.resolve();

		expect(onResult).not.toHaveBeenCalled();
	});
});

describe('fetchOnetOccupations', () => {
	it('returns occupations list from JSON response', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ occupations: SAMPLE_A }),
		} as unknown as Response);

		const res = await fetchOnetOccupations('developer', undefined, mockFetch as unknown as typeof fetch);
		expect(res).toEqual(SAMPLE_A);
		expect(mockFetch).toHaveBeenCalledWith('/api/onet/search?keyword=developer', { signal: undefined });
	});

	it('throws error with API error message on non-ok response', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			json: async () => ({ error: { message: 'Custom API error' } }),
		} as unknown as Response);

		await expect(fetchOnetOccupations('bad', undefined, mockFetch as unknown as typeof fetch)).rejects.toThrow(
			'Custom API error',
		);
	});

	it('falls back to generic error when response JSON cannot be read', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			json: async () => {
				throw new Error('invalid json');
			},
		} as unknown as Response);

		await expect(fetchOnetOccupations('bad', undefined, mockFetch as unknown as typeof fetch)).rejects.toThrow(
			GENERIC_ONET_ERROR,
		);
	});
});
