import { createSelector } from "reselect";
import { map } from "lodash-es";

const getFiles = state => state.files.documents;

export const filesSelector = createSelector(getFiles, list => map(list, "id"));
