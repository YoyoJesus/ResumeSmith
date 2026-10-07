export function normalizeText(str: string): string {
	return str
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toLowerCase();
}

export type FilterFunction = (query: string, limit?: number) => string[];

export function createOptionIndex(options: readonly string[]): FilterFunction {
	const indexed = options.map((raw) => ({
		raw,
		norm: normalizeText(raw),
	}));

	return function search(query: string, limit = 8): string[] {
		if (limit <= 0) return [];
		const trimmed = query.trim();
		if (!trimmed) return [];

		const normQuery = normalizeText(trimmed);
		const tokens = normQuery.split(/\s+/).filter(Boolean);
		if (tokens.length === 0) return [];

		const rank0: string[] = [];
		const rank1: string[] = [];
		const rank2: string[] = [];

		for (let i = 0; i < indexed.length; i++) {
			const item = indexed[i];
			let allTokens = true;
			for (let t = 0; t < tokens.length; t++) {
				if (!item.norm.includes(tokens[t])) {
					allTokens = false;
					break;
				}
			}
			if (!allTokens) continue;

			if (item.norm.startsWith(normQuery)) {
				rank0.push(item.raw);
			} else {
				let isWord = false;
				let pos = item.norm.indexOf(normQuery);
				while (pos !== -1) {
					if (pos === 0 || !/[a-z0-9]/.test(item.norm[pos - 1])) {
						isWord = true;
						break;
					}
					pos = item.norm.indexOf(normQuery, pos + 1);
				}
				if (isWord) {
					rank1.push(item.raw);
				} else {
					rank2.push(item.raw);
				}
			}
		}

		const results: string[] = [];
		for (let i = 0; i < rank0.length && results.length < limit; i++) {
			results.push(rank0[i]);
		}
		for (let i = 0; i < rank1.length && results.length < limit; i++) {
			results.push(rank1[i]);
		}
		for (let i = 0; i < rank2.length && results.length < limit; i++) {
			results.push(rank2[i]);
		}

		return results;
	};
}

const cachedIndexes = new WeakMap<readonly string[], FilterFunction>();

export function filterOptions(options: readonly string[], query: string, limit = 8): string[] {
	let index = cachedIndexes.get(options);
	if (!index) {
		index = createOptionIndex(options);
		cachedIndexes.set(options, index);
	}
	return index(query, limit);
}
