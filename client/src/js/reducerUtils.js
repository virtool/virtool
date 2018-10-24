import {
  reject,
  map,
  includes,
  concat,
  sortBy,
  slice,
  unionBy
} from "lodash-es";

export const updateDocuments = (state, action) => ({
  ...state,
  ...action.data,
  documents: unionBy([state.documents, action.data.documents], "id")
});

export const insert = (
  documents,
  page,
  per_page,
  action,
  sortKey,
  sortReverse
) => {
  const beforeList = documents ? documents.slice() : [];
  const newPage = page || 1;
  const perPage = per_page || 25;

  let newList = concat(beforeList, [{ ...action.data }]);
  newList = sortBy(newList, sortKey);

  if (sortReverse) {
    newList = newList.reverse();
  }

  // Only display listings that would be included in the
  // current pages, to synchronize with database pages
  return slice(newList, 0, perPage * newPage);
};

export const edit = (documents, action) => {
  if (!documents) {
    return documents;
  }

  return map(documents, entry => {
    if (entry.id === action.data.id) {
      return action.data;
    }
    return entry;
  });
};

export const remove = (documents, action) => {
  if (!documents) {
    return documents;
  }

  return reject(documents, ({ id }) => includes(action.data, id));
};
