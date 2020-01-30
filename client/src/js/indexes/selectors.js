import { find, get } from "lodash-es";
import { createSelector } from "reselect";

export const getIndexes = state => state.indexes.documents || [];

export const getActiveIndexId = createSelector(getIndexes, indexes =>
    get(find(indexes, { ready: true, has_files: true }), "id")
);
