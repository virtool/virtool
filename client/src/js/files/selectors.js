import { createSelector } from "reselect";
import { filter, keyBy, map } from "lodash-es";

const getFiles = state => state.files.documents;

export const getFilesById = createSelector(getFiles, files => keyBy(files, "id"));

export const getFilteredFileIds = createSelector(getFiles, list =>
    map(
        filter(list, document => document.ready && !document.reserved),
        "id"
    )
);
