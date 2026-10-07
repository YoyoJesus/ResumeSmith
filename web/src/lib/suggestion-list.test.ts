import { describe, expect, it, vi } from 'vitest';
import { createListLoader } from './suggestion-list';

describe('createListLoader', () => {
	it('loads list successfully from specified url', async () => {
		const loader = createListLoader('/test-items.json');
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ['Item A', 'Item B'],
		});

		const result = await loader.load(mockFetch as unknown as typeof fetch);
		expect(result).toEqual(['Item A', 'Item B']);
		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(mockFetch).toHaveBeenCalledWith('/test-items.json');
	});

	it('caches the result across multiple calls', async () => {
		const loader = createListLoader('/test-items.json');
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ['Item A', 'Item B'],
		});

		const first = await loader.load(mockFetch as unknown as typeof fetch);
		const second = await loader.load(mockFetch as unknown as typeof fetch);

		expect(first).toEqual(['Item A', 'Item B']);
		expect(second).toEqual(['Item A', 'Item B']);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('maintains independent caches for distinct loaders', async () => {
		const loaderA = createListLoader('/list-a.json');
		const loaderB = createListLoader('/list-b.json');

		const mockFetch = vi.fn().mockImplementation(async (url: string) => {
			if (url === '/list-a.json') {
				return {
					ok: true,
					status: 200,
					json: async () => ['A1', 'A2'],
				};
			}
			return {
				ok: true,
				status: 200,
				json: async () => ['B1', 'B2'],
			};
		});

		const resultA = await loaderA.load(mockFetch as unknown as typeof fetch);
		const resultB = await loaderB.load(mockFetch as unknown as typeof fetch);

		expect(resultA).toEqual(['A1', 'A2']);
		expect(resultB).toEqual(['B1', 'B2']);
		expect(mockFetch).toHaveBeenCalledTimes(2);

		// Second call to loaderA uses its cache without fetching
		const resultA2 = await loaderA.load(mockFetch as unknown as typeof fetch);
		expect(resultA2).toEqual(['A1', 'A2']);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('returns an empty array and clears cache on non-OK status, allowing retry', async () => {
		const loader = createListLoader('/test-items.json');
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 500,
			json: async () => ({ error: 'Internal Server Error' }),
		});

		const result = await loader.load(mockFetch as unknown as typeof fetch);
		expect(result).toEqual([]);
		expect(mockFetch).toHaveBeenCalledTimes(1);

		// Retry after failure succeeds
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ['Recovered Item'],
		});
		const retryResult = await loader.load(mockFetch as unknown as typeof fetch);
		expect(retryResult).toEqual(['Recovered Item']);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('returns an empty array and clears cache on rejected fetch, allowing retry', async () => {
		const loader = createListLoader('/test-items.json');
		const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

		const result = await loader.load(mockFetch as unknown as typeof fetch);
		expect(result).toEqual([]);
		expect(mockFetch).toHaveBeenCalledTimes(1);

		// Retry after failure succeeds
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ['Recovered Item'],
		});
		const retryResult = await loader.load(mockFetch as unknown as typeof fetch);
		expect(retryResult).toEqual(['Recovered Item']);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('returns an empty array and clears cache on malformed payload', async () => {
		const loader = createListLoader('/test-items.json');
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ not: 'an array' }),
		});

		const result1 = await loader.load(mockFetch as unknown as typeof fetch);
		expect(result1).toEqual([]);

		// Array with non-string elements
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => [123, 'valid'],
		});
		const result2 = await loader.load(mockFetch as unknown as typeof fetch);
		expect(result2).toEqual([]);
	});

	it('clears cache explicitly when reset is called', async () => {
		const loader = createListLoader('/test-items.json');
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ['Item A'],
		});

		await loader.load(mockFetch as unknown as typeof fetch);
		expect(mockFetch).toHaveBeenCalledTimes(1);

		loader.reset();

		await loader.load(mockFetch as unknown as typeof fetch);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});
});
