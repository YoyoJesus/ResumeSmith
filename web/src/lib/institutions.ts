import { createListLoader } from './suggestion-list';

const loader = createListLoader('/institutions.json');

export const resetInstitutionsCache = loader.reset;
export const loadInstitutions = loader.load;
