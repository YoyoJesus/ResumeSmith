import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadInstitutions, resetInstitutionsCache } from './institutions';

describe('loadInstitutions', () => {
	beforeEach(() => {
		resetInstitutionsCache();
	});

	it('loads institutions successfully', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ['Harvard University', 'MIT', 'Stanford University'],
		});

		const result = await loadInstitutions(mockFetch as unknown as typeof fetch);
		expect(result).toEqual(['Harvard University', 'MIT', 'Stanford University']);
		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(mockFetch).toHaveBeenCalledWith('/institutions.json');
	});

	it('caches the result across multiple calls', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ['Harvard University', 'MIT'],
		});

		const first = await loadInstitutions(mockFetch as unknown as typeof fetch);
		const second = await loadInstitutions(mockFetch as unknown as typeof fetch);

		expect(first).toEqual(['Harvard University', 'MIT']);
		expect(second).toEqual(['Harvard University', 'MIT']);
		expect(mockFetch).toHaveBeenCalledTimes(1);
	});

	it('returns an empty array and clears cache on non-OK status', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: false,
			status: 404,
			json: async () => ({ error: 'Not found' }),
		});

		const result = await loadInstitutions(mockFetch as unknown as typeof fetch);
		expect(result).toEqual([]);
		expect(mockFetch).toHaveBeenCalledTimes(1);

		// Subsequent call retries because cache was cleared
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ['Recovered College'],
		});
		const retryResult = await loadInstitutions(mockFetch as unknown as typeof fetch);
		expect(retryResult).toEqual(['Recovered College']);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('returns an empty array and clears cache on rejected fetch', async () => {
		const mockFetch = vi.fn().mockRejectedValue(new Error('Network failure'));

		const result = await loadInstitutions(mockFetch as unknown as typeof fetch);
		expect(result).toEqual([]);
		expect(mockFetch).toHaveBeenCalledTimes(1);

		// Subsequent call retries
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ['Recovered College'],
		});
		const retryResult = await loadInstitutions(mockFetch as unknown as typeof fetch);
		expect(retryResult).toEqual(['Recovered College']);
		expect(mockFetch).toHaveBeenCalledTimes(2);
	});

	it('returns an empty array and clears cache on malformed payload', async () => {
		const mockFetch = vi.fn().mockResolvedValue({
			ok: true,
			status: 200,
			json: async () => ({ unexpected: 'object' }),
		});

		const result1 = await loadInstitutions(mockFetch as unknown as typeof fetch);
		expect(result1).toEqual([]);

		// Array containing non-string items
		mockFetch.mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => [123, 'valid string'],
		});
		const result2 = await loadInstitutions(mockFetch as unknown as typeof fetch);
		expect(result2).toEqual([]);
	});
});
