import { getTermSelectorFactory } from "../utils/selectors";

export const getStateTerm = state => state.hmms.term;

export const getTerm = getTermSelectorFactory(getStateTerm);
