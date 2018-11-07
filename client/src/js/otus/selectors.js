import { getTermSelectorFactory } from "../utils/selectors";

const getStateTerm = state => state.otus.term;

export const getTerm = getTermSelectorFactory(getStateTerm);
