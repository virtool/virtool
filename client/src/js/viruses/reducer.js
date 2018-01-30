import { find, map } from "lodash-es";

import { formatIsolateName } from "../utils";
import {
    WS_UPDATE_STATUS,
    FIND_VIRUSES,
    GET_VIRUS,
    CREATE_VIRUS,
    EDIT_VIRUS,
    REMOVE_VIRUS,
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
    SHOW_EDIT_VIRUS,
    SHOW_REMOVE_VIRUS,
    SHOW_ADD_ISOLATE,
    SHOW_EDIT_ISOLATE,
    SHOW_REMOVE_ISOLATE,
    SHOW_ADD_SEQUENCE,
    SHOW_EDIT_SEQUENCE,
    SHOW_REMOVE_SEQUENCE,
    HIDE_VIRUS_MODAL,
    GET_VIRUS_HISTORY
} from "../actionTypes";

const initialState = {
    documents: null,
    detail: null,
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
    createError: "",
    editError: "",
    importData: null
};

const hideVirusModal = state => ({
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

const getActiveIsolate = (state) => {
    const isolates = state.detail.isolates;

    if (isolates.length) {
        const activeIsolate = find(isolates, {id: state.activeIsolateId}) || isolates[0];

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

const receiveVirus = (state, action) => {
    const detail = {
        ...action.data,
        isolates: map(action.data.isolates, isolate => ({...isolate, name: formatIsolateName(isolate)}))
    };

    return getActiveIsolate({...state, detail});
};

export default function virusesReducer (state = initialState, action) {

    switch (action.type) {

        case WS_UPDATE_STATUS:
            if (action.data.id === "virus_import") {
                return {...state, importData: {...state.importData, ...action.data, inProgress: true}};
            }

            return state;

        case FIND_VIRUSES.REQUESTED:
            return {...state, ...action.terms};

        case FIND_VIRUSES.SUCCEEDED:
            return {...state, ...action.data};

        case CREATE_VIRUS.FAILED:
            return {...state, createError: action.error};

        case GET_VIRUS.REQUESTED:
        case REMOVE_VIRUS.SUCCEEDED:
            return hideVirusModal({...state, detail: null, activeIsolateId: null});

        case EDIT_VIRUS.FAILED:
            if (action.status === 409) {
                return {...state, editError: action.message};
            }

            return state;

        case GET_VIRUS.SUCCEEDED:
        case EDIT_VIRUS.SUCCEEDED:
        case EDIT_ISOLATE.SUCCEEDED:
        case ADD_SEQUENCE.SUCCEEDED:
        case EDIT_SEQUENCE.SUCCEEDED:
        case REMOVE_SEQUENCE.SUCCEEDED:
        case SET_ISOLATE_AS_DEFAULT.SUCCEEDED:
        case ADD_ISOLATE.SUCCEEDED:
        case REMOVE_ISOLATE.SUCCEEDED: {
            return hideVirusModal(receiveVirus(state, action));
        }

        case GET_VIRUS_HISTORY.REQUESTED:
            return {...state, detailHistory: null};

        case GET_VIRUS_HISTORY.SUCCEEDED:
            return {...state, detailHistory: action.data};

        case REVERT.SUCCEEDED:
            return {...receiveVirus(state, action), detailHistory: action.history};

        case UPLOAD_IMPORT.SUCCEEDED:
            return {...state, importData: {...action.data, inProgress: false}};

        case SELECT_ISOLATE:
            return {
                ...state,
                activeIsolate: find(state.detail.isolates, {id: action.isolateId}),
                activeIsolateId: action.isolateId
            };

        case SHOW_EDIT_VIRUS:
            return {...state, edit: true, editError: ""};

        case SHOW_REMOVE_VIRUS:
            return {...state, remove: true};

        case SHOW_ADD_ISOLATE:
            return {...state, addIsolate: true};

        case SHOW_EDIT_ISOLATE:
            return {...state, editIsolate: true};

        case SHOW_REMOVE_ISOLATE:
            return {...state, removeIsolate: true};

        case SHOW_ADD_SEQUENCE:
            return {...state, addSequence: true};

        case SHOW_EDIT_SEQUENCE:
            return {...state, editSequence: action.sequenceId};

        case SHOW_REMOVE_SEQUENCE:
            return {...state, removeSequence: action.sequenceId};

        case HIDE_VIRUS_MODAL:
            return hideVirusModal(state);

        default:
            return state;
    }
}
