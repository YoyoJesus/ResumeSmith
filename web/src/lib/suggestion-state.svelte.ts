import { loadInstitutions } from './institutions';
import { loadLocations } from './locations';

class LazySuggestionList {
	items = $state<readonly string[]>([]);
	private loading = false;
	private loader: () => Promise<readonly string[]>;

	constructor(loader: () => Promise<readonly string[]>) {
		this.loader = loader;
	}

	ensureLoaded = async (): Promise<void> => {
		if (this.items.length > 0 || this.loading) return;
		this.loading = true;
		try {
			this.items = await this.loader();
		} finally {
			this.loading = false;
		}
	};
}

export const institutionsList = new LazySuggestionList(loadInstitutions);
export const locationsList = new LazySuggestionList(loadLocations);
