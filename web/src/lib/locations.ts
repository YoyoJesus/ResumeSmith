import { createListLoader } from './suggestion-list';

const loader = createListLoader('/locations.json');

export const resetLocationsCache = loader.reset;
export const loadLocations = loader.load;
