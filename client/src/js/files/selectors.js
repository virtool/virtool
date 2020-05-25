import { keyBy, map, reject, sortBy } from "lodash-es";
import { createSelector } from "reselect";

const getFiles = state => state.files.documents;

export const getFilesById = createSelector(getFiles, files => keyBy(files, "id"));

export const getFilteredFileIds = createSelector(getFiles, list =>
    map(
        sortBy(
            reject(list, document => document.reserved),
            "uploaded_at"
        ).reverse(),
        "id"
    )
);
