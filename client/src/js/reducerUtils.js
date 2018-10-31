import { reject, map, includes, sortBy, unionBy } from "lodash-es";

export const updateDocuments = (state, action) => {
    const existing = action.data.page === 1 ? [] : state.documents || [];

    return {
        ...state,
        ...action.data,
        documents: unionBy(existing, action.data.documents, "id")
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

export const update = (state, action) => {
    if (!state.documents) {
        return state;
    }

    return {
        ...state,
        documents: updateMember(state.documents, action)
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
