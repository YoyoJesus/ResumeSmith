import { writable, get } from 'svelte/store';

// A display preference only: whether the footer is collapsed to its one-line bar.
export const FOOTER_STORAGE_KEY = 'footerCollapsed';

function createFooterStore() {
	const { subscribe, set, update } = writable(false);

	return {
		subscribe,
		toggle: () => update((collapsed) => !collapsed),
		reset: () => set(false),
		loadFromStorage: () => {
			try {
				if (typeof localStorage === 'undefined') return;
				set(localStorage.getItem(FOOTER_STORAGE_KEY) === 'true');
			} catch {
				// Storage may be blocked; fall back to the expanded footer.
			}
		},
		saveToStorage: () => {
			try {
				if (typeof localStorage === 'undefined') return;
				if (get({ subscribe })) localStorage.setItem(FOOTER_STORAGE_KEY, 'true');
				else localStorage.removeItem(FOOTER_STORAGE_KEY);
			} catch {
				// Storage may be blocked or full; keep the in-memory preference usable.
			}
		},
	};
}

export const footerStore = createFooterStore();
