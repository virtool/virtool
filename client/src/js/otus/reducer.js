import { find, map } from "lodash-es";
import { updateDocuments, insert, remove, update } from "../reducerUtils";
import { formatIsolateName } from "../utils";
import {
    WS_INSERT_OTU,
    WS_UPDATE_OTU,
    WS_REMOVE_OTU,
    WS_UPDATE_STATUS,
    FIND_OTUS,
    GET_OTU,
    EDIT_OTU,
    REMOVE_OTU,
    ADD_ISOLATE,
    EDIT_ISOLATE,
    SET_ISOLATE_AS_DEFAULT,
    REMOVE_ISOLATE,
    ADD_SEQUENCE,
    EDIT_SEQUENCE,
    REMOVE_SEQUENCE,
    REVERT,
    UPLOAD_IMPORT,
    SELECT_ISOLATE,
    SHOW_EDIT_OTU,
    SHOW_REMOVE_OTU,
    SHOW_ADD_ISOLATE,
    SHOW_EDIT_ISOLATE,
    SHOW_REMOVE_ISOLATE,
    SHOW_ADD_SEQUENCE,
    SHOW_EDIT_SEQUENCE,
    SHOW_REMOVE_SEQUENCE,
    HIDE_OTU_MODAL,
    GET_OTU_HISTORY
} from "../actionTypes";

export const initialState = {
    term: "",
    referenceId: "",
    documents: null,
    detail: null,
    page: 0,
    fetched: false,
    refetchPage: false,
    detailHistory: null,
    edit: false,
    remove: false,
    addIsolate: false,
    editIsolate: false,
    removeIsolate: false,
    addSequence: false,
    editSequence: false,
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
    addSequence: false,
    editSequence: false,
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
            if (action.data.reference.id === state.referenceId) {
                return insert(state, action, "name");
            }

            return state;

        case WS_UPDATE_OTU:
            if (action.data.reference.id === state.referenceId) {
                return update(state.documents, action);
            }

            return state;

        case WS_REMOVE_OTU:
            return remove(state.documents, action);

        case FIND_OTUS.REQUESTED:
            console.log(action);
            return {
                ...state,
                term: action.term,
                verified: action.verified
            };

        case FIND_OTUS.SUCCEEDED:
            return updateDocuments(state, action);

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

        case SHOW_ADD_SEQUENCE:
            return { ...state, addSequence: true };

        case SHOW_EDIT_SEQUENCE:
            return { ...state, editSequence: action.sequenceId };

        case SHOW_REMOVE_SEQUENCE:
            return { ...state, removeSequence: action.sequenceId };

        case HIDE_OTU_MODAL:
            return hideOTUModal(state);

        default:
            return state;
    }
}
