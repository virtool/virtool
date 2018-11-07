import { sortBy, unionBy, concat } from "lodash-es";
import {
    WS_INSERT_GROUP,
    WS_UPDATE_GROUP,
    WS_REMOVE_GROUP,
    LIST_GROUPS,
    CREATE_GROUP,
    SET_GROUP_PERMISSION,
    REMOVE_GROUP
} from "../app/actionTypes";
import { update, remove, insert } from "../utils/reducers";

export const initialState = {
    documents: null
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
            return remove(state, action);

        case LIST_GROUPS.SUCCEEDED:
            return { ...state, documents: action.data };

        case CREATE_GROUP.REQUESTED:
        case REMOVE_GROUP.REQUESTED:
        case SET_GROUP_PERMISSION.REQUESTED:
            return { ...state, pending: true };

        case CREATE_GROUP.SUCCEEDED:
        case REMOVE_GROUP.SUCCEEDED:
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
