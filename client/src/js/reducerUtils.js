import {
    find,
    differenceWith,
    isEqual,
    concat,
    sortBy,
    slice,
    forEach
} from "lodash-es";

export const updateList = (documents, action) => {
    const beforeList = documents || [];
    const newList = concat(beforeList, action.data.documents);

    return {...action.data, documents: newList};
};

export const insert = (documents, page, per_page, action) => {
    let newList = concat(documents, {...action.data});
    newList = sortBy(newList, "id");

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
