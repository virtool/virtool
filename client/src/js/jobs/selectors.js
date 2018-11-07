import { getTermSelectorFactory } from "../utils/selectors";

const getStateTerm = state => state.jobs.term;

export const getTerm = getTermSelectorFactory(getStateTerm);
