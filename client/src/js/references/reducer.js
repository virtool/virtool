import { concat, pull, reject, some } from "lodash-es";
import {
    WS_INSERT_REFERENCE,
    WS_UPDATE_REFERENCE,
    WS_REMOVE_REFERENCE,
    FIND_REFERENCES,
    GET_REFERENCE,
    EDIT_REFERENCE,
    UPLOAD,
    CHECK_REMOTE_UPDATES,
    UPDATE_REMOTE_REFERENCE,
    ADD_REFERENCE_USER,
    EDIT_REFERENCE_USER,
    REMOVE_REFERENCE_USER,
    ADD_REFERENCE_GROUP,
    EDIT_REFERENCE_GROUP,
    REMOVE_REFERENCE_GROUP
} from "../actionTypes";
import { updateDocuments, insert, update, remove, updateMember } from "../reducerUtils";

export const initialState = {
    term: "",
    history: null,
    documents: null,
    page: 0,
    total_count: 0,
    detail: null
};

export const checkHasOfficialRemote = state =>
    some(state.documents, ["remotes_from", { slug: "virtool/ref-plant-viruses" }]);



export const removeMember = (list, pendingRemoves) => {
    const target = pendingRemoves[0];
    pull(pendingRemoves, target);

    return reject(list, ["id", target]);
};

export default function referenceReducer(state = initialState, action) {
    switch (action.type) {
        case WS_INSERT_REFERENCE: {
            const updated = insert(state, action, "name");
            return {
                ...updated,
                installOfficial: checkHasOfficialRemote(updated)
            };
        }

        case WS_UPDATE_REFERENCE: {
            const updated = update(state, action);
            return {
                ...updated,
                installOfficial: checkHasOfficialRemote(updated)
            };
        }

        case WS_REMOVE_REFERENCE: {
            const updated = remove(state, action);
            return {
                ...updated,
                installOfficial: checkHasOfficialRemote(updated)
            };
        }

      case FIND_REFERENCES.REQUESTED:
            return {
              ...state,
              term: action.term
            };

        case FIND_REFERENCES.SUCCEEDED:
            return {
                ...updateDocuments(state, action),
                installOfficial: checkHasOfficialRemote(state)
            };

        case GET_REFERENCE.REQUESTED:
            return { ...state, detail: null };

        case GET_REFERENCE.SUCCEEDED:
            return { ...state, detail: action.data };

        case EDIT_REFERENCE.SUCCEEDED:
            return { ...state, detail: action.data };

        case UPLOAD.SUCCEEDED:
            return { ...state, importData: { ...action.data } };

        case CHECK_REMOTE_UPDATES.REQUESTED:
            return { ...state, detail: { ...state.detail, checkPending: true } };

        case CHECK_REMOTE_UPDATES.FAILED:
            return { ...state, detail: { ...state.detail, checkPending: false } };

        case CHECK_REMOTE_UPDATES.SUCCEEDED:
            return {
                ...state,
                detail: { ...state.detail, checkPending: false, release: action.data }
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
