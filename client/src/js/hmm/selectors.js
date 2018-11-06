import { getTermSelectorFactory } from "../utils/selectors";

const getStateTerm = state => state.hmms.term;

export const getTerm = getTermSelectorFactory(getStateTerm);
