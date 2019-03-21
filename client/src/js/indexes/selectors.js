import { find, get } from "lodash-es";
import { createSelector } from "reselect";

const indexesSelector = state => state.indexes.documents || [];

export const activeIndexIdSelector = createSelector(
    indexesSelector,
    indexes => get(find(indexes, { ready: true, has_files: true }), "id")
);
