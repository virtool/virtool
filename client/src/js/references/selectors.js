import { some } from "lodash-es";
import { getTermSelectorFactory } from "../utils/selectors";

const getStateTerm = state => state.references.term;

export const getTerm = getTermSelectorFactory(getStateTerm);

export const getHasOfficial = state =>
    some(state.references.documents, ["remotes_from.slug", "virtool/ref-plant-viruses"]);
