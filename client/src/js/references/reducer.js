import { concat } from "lodash-es";
import {
    ADD_REFERENCE_GROUP,
    ADD_REFERENCE_USER,
    CHECK_REMOTE_UPDATES,
    EDIT_REFERENCE,
    EDIT_REFERENCE_GROUP,
    EDIT_REFERENCE_USER,
    FIND_REFERENCES,
    GET_REFERENCE,
    REMOVE_REFERENCE_GROUP,
    REMOVE_REFERENCE_USER,
    UPDATE_REMOTE_REFERENCE,
    UPLOAD,
    WS_INSERT_REFERENCE,
    WS_REMOVE_REFERENCE,
    WS_UPDATE_REFERENCE
} from "../app/actionTypes";
import { insert, remove, update, updateDocuments, updateMember } from "../utils/reducers";
import { removeMember } from "./utils";

export const initialState = {
    term: "",
    history: null,
    documents: null,
    page: 0,
    total_count: 0,
    detail: null,
    checking: false
};

export default function referenceReducer(state = initialState, action) {
    switch (action.type) {
        case WS_INSERT_REFERENCE: {
            const updated = insert(state, action, "name");
            return {
                ...updated
            };
        }

        case WS_UPDATE_REFERENCE: {
            const updated = update(state, action, "name");

            if (state.detail && state.detail.id === action.data.id) {
                return { ...state, detail: { ...state.detail, ...action.data } };
            }

            return updated;
        }

        case WS_REMOVE_REFERENCE: {
            return remove(state, action);
        }

        case FIND_REFERENCES.REQUESTED:
            return {
                ...state,
                term: action.term
            };

        case FIND_REFERENCES.SUCCEEDED:
            return updateDocuments(state, action, "name");

        case GET_REFERENCE.REQUESTED:
            return { ...state, detail: null };

        case GET_REFERENCE.SUCCEEDED:
            return { ...state, detail: action.data };

        case EDIT_REFERENCE.SUCCEEDED:
            return { ...state, detail: action.data };

        case UPLOAD.SUCCEEDED:
            return { ...state, importData: { ...action.data } };

        case CHECK_REMOTE_UPDATES.REQUESTED:
            return { ...state, checking: true };

        case CHECK_REMOTE_UPDATES.FAILED:
            return { ...state, checking: false };

        case CHECK_REMOTE_UPDATES.SUCCEEDED:
            return {
                ...state,
                checking: false,
                detail: { ...state.detail, release: action.data }
            };

        case UPDATE_REMOTE_REFERENCE.SUCCEEDED:
            return { ...state, detail: { ...state.detail, release: action.data } };

        case ADD_REFERENCE_USER.SUCCEEDED:
            return {
                ...state,
                detail: {
                    ...state.detail,
                    users: concat(state.detail.users, [action.data])
                }
            };

        case EDIT_REFERENCE_USER.SUCCEEDED:
            return {
                ...state,
                detail: { ...state.detail, users: updateMember(state.detail.users, action) }
            };

        case REMOVE_REFERENCE_USER.REQUESTED:
            return {
                ...state,
                detail: {
                    ...state.detail,
                    pendingUserRemove:
                        action.refId === state.detail.id ? concat([], [action.userId]) : state.detail.pendingUserRemove
                }
            };

        case REMOVE_REFERENCE_USER.SUCCEEDED:
            return {
                ...state,
                detail: {
                    ...state.detail,
                    users: removeMember(state.detail.users, state.detail.pendingUserRemove)
                }
            };

        case ADD_REFERENCE_GROUP.SUCCEEDED:
            return {
                ...state,
                detail: {
                    ...state.detail,
                    groups: concat(state.detail.groups, [action.data])
                }
            };

        case EDIT_REFERENCE_GROUP.SUCCEEDED:
            return {
                ...state,
                detail: { ...state.detail, groups: updateMember(state.detail.groups, action) }
            };

        case REMOVE_REFERENCE_GROUP.REQUESTED:
            return {
                ...state,
                detail: {
                    ...state.detail,
                    pendingGroupRemove:
                        action.refId === state.detail.id
                            ? concat([], [action.groupId])
                            : state.detail.pendingGroupRemove
                }
            };

        case REMOVE_REFERENCE_GROUP.SUCCEEDED:
            return {
                ...state,
                detail: {
                    ...state.detail,
                    groups: removeMember(state.detail.groups, state.detail.pendingRemove)
                }
            };

        default:
            return state;
    }
}
