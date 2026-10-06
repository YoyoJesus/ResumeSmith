import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { get } from 'svelte/store';
import { footerStore, FOOTER_STORAGE_KEY } from './footer-store';

function fakeStorage() {
	const map = new Map<string, string>();
	return {
		getItem: (k: string) => map.get(k) ?? null,
		setItem: (k: string, v: string) => void map.set(k, v),
		removeItem: (k: string) => void map.delete(k),
	} as unknown as Storage;
}

beforeEach(() => {
	footerStore.reset();
	vi.stubGlobal('localStorage', fakeStorage());
});

afterEach(() => vi.unstubAllGlobals());

describe('footerStore', () => {
	it('starts expanded', () => {
		expect(get(footerStore)).toBe(false);
	});

	it('round-trips the collapsed preference through storage', () => {
		footerStore.toggle();
		footerStore.saveToStorage();
		expect(localStorage.getItem(FOOTER_STORAGE_KEY)).toBe('true');

		footerStore.reset();
		footerStore.loadFromStorage();
		expect(get(footerStore)).toBe(true);
	});

	it('removes the key once the footer is expanded again', () => {
		footerStore.toggle();
		footerStore.saveToStorage();
		footerStore.toggle();
		footerStore.saveToStorage();

		expect(localStorage.getItem(FOOTER_STORAGE_KEY)).toBeNull();
		footerStore.loadFromStorage();
		expect(get(footerStore)).toBe(false);
	});

	it('treats any unexpected stored value as expanded', () => {
		localStorage.setItem(FOOTER_STORAGE_KEY, '{not json');
		footerStore.loadFromStorage();
		expect(get(footerStore)).toBe(false);
	});

	it('keeps the preference usable when storage operations throw', () => {
		vi.stubGlobal('localStorage', {
			getItem() {
				throw new Error('blocked');
			},
			setItem() {
				throw new Error('quota');
			},
			removeItem() {
				throw new Error('blocked');
			},
		});
		footerStore.toggle();
		expect(() => footerStore.loadFromStorage()).not.toThrow();
		expect(() => footerStore.saveToStorage()).not.toThrow();
		expect(get(footerStore)).toBe(true);
	});
});
