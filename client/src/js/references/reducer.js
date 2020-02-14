import { concat, reject, union, without } from "lodash-es";
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
    UPLOAD_PROGRESS,
    WS_INSERT_REFERENCE,
    WS_REMOVE_REFERENCE,
    WS_UPDATE_REFERENCE
} from "../app/actionTypes";
import { insert, remove, update, updateDocuments, updateMember } from "../utils/reducers";

export const initialState = {
    term: "",
    history: null,
    documents: null,
    page: 0,
    total_count: 0,
    detail: null,
    checking: false,
    importFileId: null,
    importFileName: null,
    importUploadId: null,
    importUploadProgress: 0,
    pendingRemoveGroups: [],
    pendingRemoveUsers: []
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
                return {
                    ...state,
                    detail: { ...state.detail, ...action.data }
                };
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

        case UPLOAD.REQUESTED:
            if (action.fileType === "reference") {
                return {
                    ...state,
                    importFile: null,
                    importUploadId: action.localId,
                    importUploadName: action.name,
                    importUploadProgress: 0
                };
            }

            return state;

        case UPLOAD.SUCCEEDED:
            if (state.importUploadId === action.data.localId) {
                return {
                    ...state,
                    importFile: action.data,
                    importUploadId: null,
                    importUploadName: null,
                    importUploadProgress: 0
                };
            }
            return state;

        case UPLOAD.FAILED:
            if (action.fileType === "reference") {
                return {
                    ...state,
                    importFile: null,
                    importUploadId: null,
                    importUploadProgress: 0
                };
            }

            return state;

        case UPLOAD_PROGRESS:
            if (state.importUploadId === action.localId) {
                return {
                    ...state,
                    importUploadProgress: action.progress
                };
            }

            return state;

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
            return {
                ...state,
                detail: { ...state.detail, release: action.data }
            };

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
                detail: {
                    ...state.detail,
                    users: updateMember(state.detail.users, action)
                }
            };

        case REMOVE_REFERENCE_USER.REQUESTED:
            if (action.refId === state.detail.id) {
                return {
                    ...state,
                    pendingRemoveUsers: union(state.pendingRemoveUsers, [action.userId])
                };
            }

            return state;

        case REMOVE_REFERENCE_USER.SUCCEEDED:
            if (action.refId === state.detail.id) {
                return {
                    ...state,
                    pendingRemoveUsers: without(state.pendingRemoveUsers, action.userId),
                    detail: {
                        ...state.detail,
                        users: reject(state.detail.users, { id: action.userId })
                    }
                };
            }

            return state;

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
                detail: {
                    ...state.detail,
                    groups: updateMember(state.detail.groups, action)
                }
            };

        case REMOVE_REFERENCE_GROUP.REQUESTED:
            if (action.refId === state.detail.id) {
                return {
                    ...state,
                    pendingRemoveGroups: union(state.pendingRemoveGroups, [action.groupId])
                };
            }

            return state;

        case REMOVE_REFERENCE_GROUP.SUCCEEDED:
            if (action.refId === state.detail.id) {
                return {
                    ...state,
                    pendingRemoveGroups: without(state.pendingRemoveGroups, action.groupId),
                    detail: {
                        ...state.detail,
                        groups: reject(state.detail.groups, {
                            id: action.groupId
                        })
                    }
                };
            }

            return state;

        default:
            return state;
    }
}
