let cachedPromise: Promise<readonly string[]> | null = null;

export function resetInstitutionsCache(): void {
	cachedPromise = null;
}

export async function loadInstitutions(fetcher: typeof fetch = fetch): Promise<readonly string[]> {
	if (cachedPromise) {
		return cachedPromise;
	}

	cachedPromise = (async () => {
		try {
			const res = await fetcher('/institutions.json');
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
