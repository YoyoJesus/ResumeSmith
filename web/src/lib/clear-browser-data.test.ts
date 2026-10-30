import { describe, expect, it } from 'vitest';
import { removeOwnedStorageKeys } from './clear-browser-data';

describe('removeOwnedStorageKeys', () => {
	it('reports keys that could not be removed instead of claiming success', () => {
		const result = removeOwnedStorageKeys(
			{
				getItem: (key) => (key === 'blocked' ? 'still here' : null),
				removeItem: (key) => {
					if (key === 'throws') throw new DOMException('denied', 'SecurityError');
				},
			},
			['removed', 'blocked', 'throws'],
		);

		expect(result.removed).toEqual(['removed']);
		expect(result.failed).toEqual(['blocked', 'throws']);
	});
});
