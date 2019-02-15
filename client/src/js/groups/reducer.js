import { concat, get, some, sortBy, unionBy } from "lodash-es";
import {
    CHANGE_ACTIVE_GROUP,
    CREATE_GROUP,
    LIST_GROUPS,
    REMOVE_GROUP,
    SET_GROUP_PERMISSION,
    WS_INSERT_GROUP,
    WS_REMOVE_GROUP,
    WS_UPDATE_GROUP
} from "../app/actionTypes";
import { insert, remove, update } from "../utils/reducers";

export const updateActiveId = state => {
    if (state.activeId && some(state.documents, { id: state.activeId })) {
        return state;
    }

    return {
        ...state,
        activeId: get(state, "documents[0].id", "")
    };
};

export const initialState = {
    documents: null,
    pending: false,
    activeId: ""
};

export const updateGroup = (state, update) => ({
    ...state,
    pending: false,
    documents: sortBy(unionBy([update], state.documents, "id"), "id")
});

export const insertGroup = (documents, entry) => sortBy(concat(documents, [entry]), "id");

export default function groupsReducer(state = initialState, action) {
    switch (action.type) {
        case WS_INSERT_GROUP:
            return insert(state, action, "id");

        case WS_UPDATE_GROUP:
            return update(state, action);

        case WS_REMOVE_GROUP:
            return updateActiveId(remove(state, action));

        case CHANGE_ACTIVE_GROUP:
            return {
                ...state,
                activeId: action.id
            };

        case LIST_GROUPS.SUCCEEDED:
            return updateActiveId({ ...state, documents: action.data });

        case CREATE_GROUP.REQUESTED:
        case REMOVE_GROUP.REQUESTED:
        case SET_GROUP_PERMISSION.REQUESTED:
            return { ...state, pending: true };

        case CREATE_GROUP.SUCCEEDED:
            return { ...state, pending: false, activeId: action.data.id };

        case REMOVE_GROUP.SUCCEEDED:
            return updateActiveId({ ...state, pending: false });

        case SET_GROUP_PERMISSION.SUCCEEDED:
            return { ...state, pending: false };

        case CREATE_GROUP.FAILED:
            if (action.message === "Group already exists") {
                return { ...state, createError: true, pending: false };
            }
            return state;

        default:
            return state;
    }
}
