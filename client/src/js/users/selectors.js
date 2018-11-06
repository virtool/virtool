import { getTermSelectorFactory } from "../utils/selectors";

const getStateTerm = state => state.users.term;

export const getTerm = getTermSelectorFactory(getStateTerm);
