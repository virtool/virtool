import { createSelector } from "reselect";
import { map } from "lodash-es";

const getFiles = state => state.files.documents;
const getOTUs = state => state.otus.documents;
const getSubtractions = state => state.subtraction.documents;
const getUsers = state => state.users.list;

const mapIds = list => map(list, entry => entry.id);

export const filesSelector = createSelector([getFiles], mapIds);
export const otusSelector = createSelector([getOTUs], mapIds);
export const subtractionsSelector = createSelector([getSubtractions], mapIds);

export const usersSelector = createSelector([getUsers], list => {
  if (list === null) {
    return { documents: null, page: 0, page_count: 0 };
  }

  return {
    documents: mapIds(list.documents),
    page: list.page,
    page_count: list.page_count
  };
});
