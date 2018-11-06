import { getTermSelectorFactory } from "../utils/selectors";

const getStateTerm = state => state.references.term;

export const getTerm = getTermSelectorFactory(getStateTerm);
