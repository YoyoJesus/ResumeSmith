import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadLocations, resetLocationsCache } from './locations';

describe('loadLocations', () => {
	beforeEach(() => {
		resetLocationsCache();
	});

	it('loads locations successfully', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ['Boston, MA', 'New York, NY', 'Tokyo, Japan'],
		});

		const result = await loadLocations(mockFetch as unknown as typeof fetch);
		expect(result).toEqual(['Boston, MA', 'New York, NY', 'Tokyo, Japan']);
		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(mockFetch).toHaveBeenCalledWith('/locations.json');
	});

	it('caches the result across multiple calls (single fetch)', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ['Boston, MA', 'Tokyo, Japan'],
		});

		const first = await loadLocations(mockFetch as unknown as typeof fetch);
		const second = await loadLocations(mockFetch as unknown as typeof fetch);

		expect(first).toEqual(['Boston, MA', 'Tokyo, Japan']);
		expect(second).toEqual(['Boston, MA', 'Tokyo, Japan']);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('returns an empty array and clears cache on non-OK status, allowing retry', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 404,
			json: async () => ({ error: 'Not found' }),
		});

		const result = await loadLocations(mockFetch as unknown as typeof fetch);
		expect(result).toEqual([]);
		expect(mockFetch).toHaveBeenCalledTimes(1);

		// Subsequent call retries because cache was cleared
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ['Seattle, WA'],
		});
		const retryResult = await loadLocations(mockFetch as unknown as typeof fetch);
		expect(retryResult).toEqual(['Seattle, WA']);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('returns an empty array and clears cache on rejected fetch, allowing retry', async () => {
		const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));

		const result = await loadLocations(mockFetch as unknown as typeof fetch);
		expect(result).toEqual([]);
		expect(mockFetch).toHaveBeenCalledTimes(1);

		// Subsequent call retries
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ['Chicago, IL'],
		});
		const retryResult = await loadLocations(mockFetch as unknown as typeof fetch);
		expect(retryResult).toEqual(['Chicago, IL']);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('returns an empty array and clears cache on malformed payload', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ unexpected: 'object' }),
		});

		const result1 = await loadLocations(mockFetch as unknown as typeof fetch);
		expect(result1).toEqual([]);

		// Array containing non-string items
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => [123, 'valid string'],
		});
		const result2 = await loadLocations(mockFetch as unknown as typeof fetch);
		expect(result2).toEqual([]);
	});
});
