import { find, map } from "lodash-es";
import {
    ADD_ISOLATE,
    ADD_SEQUENCE,
    EDIT_ISOLATE,
    EDIT_OTU,
    EDIT_SEQUENCE,
    FIND_OTUS,
    GET_OTU,
    GET_OTU_HISTORY,
    HIDE_OTU_MODAL,
    REFRESH_OTUS,
    REMOVE_ISOLATE,
    REMOVE_OTU,
    REMOVE_SEQUENCE,
    REVERT,
    SELECT_ISOLATE,
    SET_ISOLATE_AS_DEFAULT,
    SHOW_ADD_ISOLATE,
    SHOW_EDIT_ISOLATE,
    SHOW_EDIT_OTU,
    SHOW_REMOVE_ISOLATE,
    SHOW_REMOVE_OTU,
    SHOW_REMOVE_SEQUENCE,
    UPLOAD_IMPORT,
    WS_INSERT_OTU,
    WS_REMOVE_OTU,
    WS_UPDATE_OTU,
    WS_UPDATE_STATUS
} from "../app/actionTypes";
import { insert, remove, update, updateDocuments } from "../utils/reducers";
import { formatIsolateName } from "../utils/utils";

export const initialState = {
    term: "",
    refId: "",
    documents: null,
    detail: null,
    page: 0,
    detailHistory: null,
    edit: false,
    remove: false,
    addIsolate: false,
    editIsolate: false,
    removeIsolate: false,
    removeSequence: false,
    activeIsolateId: null,
    importData: null,
    verified: false
};

export const hideOTUModal = state => ({
    ...state,
    edit: false,
    remove: false,
    addIsolate: false,
    editIsolate: false,
    removeIsolate: false,
    removeSequence: false
});

export const getActiveIsolate = state => {
    const isolates = state.detail.isolates;

    if (isolates.length) {
        const activeIsolate = find(isolates, { id: state.activeIsolateId }) || isolates[0];

        return {
            ...state,
            activeIsolate,
            activeIsolateId: activeIsolate.id
        };
    }

    return {
        ...state,
        activeIsolate: null,
        activeIsolateId: null
    };
};

export const receiveOTU = (state, action) => {
    const detail = {
        ...action.data,
        isolates: map(action.data.isolates, isolate => ({
            ...isolate,
            name: formatIsolateName(isolate)
        }))
    };

    return getActiveIsolate({ ...state, detail });
};

export default function OTUsReducer(state = initialState, action) {
    switch (action.type) {
        case WS_UPDATE_STATUS:
            if (action.data.id === "OTU_import") {
                return {
                    ...state,
                    importData: {
                        ...state.importData,
                        ...action.data,
                        inProgress: true
                    }
                };
            }

            return state;

        case WS_INSERT_OTU:
            if (action.data.reference.id === state.refId) {
                return insert(state, action, "name");
            }

            return state;

        case WS_UPDATE_OTU:
            if (action.data.reference.id === state.refId) {
                return update(state, action, "name");
            }

            return state;

        case WS_REMOVE_OTU:
            return remove(state, action);

        case FIND_OTUS.REQUESTED:
            return {
                ...state,
                term: action.term,
                verified: action.verified,
                refId: action.refId
            };

        case FIND_OTUS.SUCCEEDED:
        case REFRESH_OTUS.SUCCEEDED:
            return updateDocuments(state, action, "name");

        case GET_OTU.REQUESTED:
        case REMOVE_OTU.SUCCEEDED:
            return hideOTUModal({ ...state, detail: null, activeIsolateId: null });

        case GET_OTU.SUCCEEDED:
        case EDIT_OTU.SUCCEEDED:
        case EDIT_ISOLATE.SUCCEEDED:
        case ADD_SEQUENCE.SUCCEEDED:
        case EDIT_SEQUENCE.SUCCEEDED:
        case REMOVE_SEQUENCE.SUCCEEDED:
        case SET_ISOLATE_AS_DEFAULT.SUCCEEDED:
        case ADD_ISOLATE.SUCCEEDED:
        case REMOVE_ISOLATE.SUCCEEDED:
            return hideOTUModal(receiveOTU(state, action));

        case GET_OTU_HISTORY.REQUESTED:
            return { ...state, detailHistory: null };

        case GET_OTU_HISTORY.SUCCEEDED:
            return { ...state, detailHistory: action.data };

        case REVERT.SUCCEEDED:
            return { ...receiveOTU(state, action), detailHistory: action.history };

        case UPLOAD_IMPORT.SUCCEEDED:
            return { ...state, importData: { ...action.data, inProgress: false } };

        case SELECT_ISOLATE:
            return {
                ...state,
                activeIsolate: find(state.detail.isolates, { id: action.isolateId }),
                activeIsolateId: action.isolateId
            };

        case SHOW_EDIT_OTU:
            return { ...state, edit: true };

        case SHOW_REMOVE_OTU:
            return { ...state, remove: true };

        case SHOW_ADD_ISOLATE:
            return { ...state, addIsolate: true };

        case SHOW_EDIT_ISOLATE:
            return { ...state, editIsolate: true };

        case SHOW_REMOVE_ISOLATE:
            return { ...state, removeIsolate: true };

        case SHOW_REMOVE_SEQUENCE:
            return { ...state, removeSequence: action.sequenceId };

        case HIDE_OTU_MODAL:
            return {
                ...state,
                edit: false,
                remove: false,
                addIsolate: false,
                editIsolate: false,
                removeIsolate: false,
                removeSequence: false
            };

        default:
            return state;
    }
}
