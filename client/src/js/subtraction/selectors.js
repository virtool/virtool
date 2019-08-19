import { createSelector } from "reselect";
import { map } from "lodash-es";

const getSubtractions = state => state.subtraction.documents;
export const subtractionsSelector = createSelector(
    getSubtractions,
    list => map(list, "id")
);
