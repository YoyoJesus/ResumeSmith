export interface ListLoader {
	load: (fetcher?: typeof fetch) => Promise<readonly string[]>;
	reset: () => void;
}

export function createListLoader(url: string): ListLoader {
	let cachedPromise: Promise<readonly string[]> | null = null;

	function reset(): void {
		cachedPromise = null;
	}

	async function load(fetcher: typeof fetch = fetch): Promise<readonly string[]> {
		if (cachedPromise) {
			return cachedPromise;
		}

		cachedPromise = (async () => {
			try {
				const res = await fetcher(url);
				if (!res.ok) {
					cachedPromise = null;
					return [];
				}
				const data: unknown = await res.json();
				if (!Array.isArray(data) || !data.every((item) => typeof item === 'string')) {
					cachedPromise = null;
					return [];
				}
				return data as readonly string[];
			} catch {
				cachedPromise = null;
				return [];
			}
		})();

		return cachedPromise;
	}

	return { load, reset };
}
