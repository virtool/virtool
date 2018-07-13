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

export const insert = (documents, page, per_page, action) => {
    let newList = concat(documents, {...action.data});
    newList = sortBy(newList, "id");

    // Only display listings that would be included in the
    // current pages, to synchronize with database pages
    return slice(newList, 0, (per_page * page));
};

export const edit = (documents, action) => {
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
    const target = find(documents, ["id", action.data[0]]);

    if (!target) {
        return documents;
    }

    const newList = differenceWith(documents, [target], isEqual);
    return newList;
};
