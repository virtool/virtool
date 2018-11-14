import { reject, map, includes, sortBy, unionBy } from "lodash-es";

export const updateDocuments = (state, action, sortKey, sortReverse) => {
    const existing = action.data.page === 1 ? [] : state.documents || [];

    const documents = sortBy(unionBy(action.data.documents, existing, "id"), sortKey);

    if (sortReverse) {
        documents.reverse();
    }

    return {
        ...state,
        ...action.data,
        documents
    };
};

export const insert = (state, action, sortKey, sortReverse = false) => {
    const documents = sortBy(unionBy(state.documents || [], [action.data], "id"), sortKey);

    if (sortReverse) {
        documents.reverse();
    }

    return {
        ...state,
        documents
    };
};

export const update = (state, action, sortKey, sortReverse = false) => {
    if (!state.documents) {
        return state;
    }

    const documents = sortBy(updateMember(state.documents, action), sortKey);

    if (sortReverse) {
        documents.reverse();
    }

    return {
        ...state,
        documents
    };
};

export const remove = (state, action) => {
    if (!state.documents) {
        return state;
    }

    return {
        ...state,
        documents: reject(state.documents, ({ id }) => includes(action.data, id))
    };
};

export const updateMember = (list, action) => {
    if (!list) {
        return list;
    }

    return map(list, item => {
        if (item.id === action.data.id) {
            return action.data;
        }
        return item;
    });
};
