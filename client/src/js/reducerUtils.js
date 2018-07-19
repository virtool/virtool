import {
    find,
    differenceWith,
    isEqual,
    concat,
    sortBy,
    slice,
    forEach
} from "lodash-es";

export const updateList = (documents, action, page) => {
    let beforeList = documents ? documents.slice() : [];

    // Current page has changed due to deletion,
    // must update latest page to synchronize with database
    if (page === action.data.page) {
        beforeList = slice(beforeList, 0, ((page - 1) * action.data.per_page));
    }

    // New page has been fetched, concat to list in state
    const newList = concat(beforeList, action.data.documents);
    return {...action.data, documents: newList};
};

export const insert = (documents, page, per_page, action, sortKey) => {
    const beforeList = documents ? documents.slice() : [];
    const newPage = page || 1;
    const perPage = per_page || 25;

    let newList = concat(beforeList, [{...action.data}]);
    newList = sortBy(newList, sortKey);

    // Only display listings that would be included in the
    // current pages, to synchronize with database pages
    return slice(newList, 0, (perPage * newPage));
};

export const edit = (documents, action) => {
    if (!documents) {
        return documents;
    }

    const newList = documents.slice();

    forEach(newList, (entry, index) => {
        if (entry.id === action.data.id) {
            newList[index] = {...action.data};
            return false;
        }
    });

    return newList;
};

export const remove = (documents, action) => {
    if (!documents) {
        return documents;
    }

    let newList = slice(documents, 0, documents.length);
    let target;

    forEach(action.data, id => {
        target = find(documents, ["id", id]);
        if (target) {
            newList = differenceWith(newList, [target], isEqual);
        }
    });

    return newList;
};
