import { createSelector } from "reselect";
import { filter, map } from "lodash-es";

const getFiles = state => state.files.documents;

export const filesSelector = createSelector(getFiles, list =>
    map(filter(list, document => document.ready && !document.reserved), "id")
);
