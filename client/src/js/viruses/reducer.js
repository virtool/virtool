/**
 * Redux reducers for working with virus data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { some } from "lodash";

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
    SELECT_SEQUENCE,
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

const virusesInitialState = {
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
    activeSequenceId: null,
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

const recalculateActiveIsolateId = (prevActiveIsolateId, nextDetail) => {
    if (!nextDetail.isolates.length) {
        return null;
    }

    // No isolates before (activeIsolateId=null), now there is one.
    if (prevActiveIsolateId === null || !some(nextDetail.isolates, {id: prevActiveIsolateId})) {
        return nextDetail.isolates[0].id;
    }

    return prevActiveIsolateId;
};

const receivedDetailAfterChange = (state, action) => ({
    ...hideVirusModal(state),
    detail: action.data
});

export default function virusesReducer (state = virusesInitialState, action) {

    switch (action.type) {

        case WS_UPDATE_STATUS:
            if (action.data.id === "virus_import") {
                return {...state, importData: {...state.importData, ...action.data, inProgress: true}};
            }

            return state;

        case FIND_VIRUSES.REQUESTED:
            return {...state, ...action.terms};

        case FIND_VIRUSES.SUCCEEDED:
            return {
                ...state,
                documents: action.data.documents,
                page: action.data.page,
                pageCount: action.data.page_count,
                totalCount: action.data.total_count,
                foundCount: action.data.found_count,
                modifiedCount: action.data.modified_count
            };

        case GET_VIRUS.REQUESTED:
            return {...state, detail: null, activeIsolateId: null, activeSequenceId: null};

        case GET_VIRUS.SUCCEEDED:
            return {
                ...state,
                detail: action.data,
                activeIsolateId: action.data.isolates.length ? action.data.isolates[0].id : null
            };

        case CREATE_VIRUS.FAILED:
            return {...state, createError: action.error};

        case REMOVE_VIRUS.SUCCEEDED:
            return {...state, detail: null, actionIsolateId: null, remove: false};

        case EDIT_VIRUS.FAILED:
            return {...state, editError: action.message};

        case ADD_ISOLATE.SUCCEEDED:
            return {
                ...receivedDetailAfterChange(state, action),
                activeIsolateId: action.data.isolates[action.data.isolates.length - 1].id
            };

        case EDIT_VIRUS.SUCCEEDED:
        case EDIT_ISOLATE.SUCCEEDED:
        case SET_ISOLATE_AS_DEFAULT.SUCCEEDED:
        case REMOVE_ISOLATE.SUCCEEDED:
        case ADD_SEQUENCE.SUCCEEDED:
        case EDIT_SEQUENCE.SUCCEEDED:
        case REMOVE_SEQUENCE.SUCCEEDED:
            return receivedDetailAfterChange(state, action);

        case GET_VIRUS_HISTORY.REQUESTED:
            return {...state, detailHistory: null};

        case GET_VIRUS_HISTORY.SUCCEEDED:
            return {...state, detailHistory: action.data};

        case REVERT.SUCCEEDED:
            return {
                ...state,
                detail: action.detail,
                detailHistory: action.history,
                activeIsolateId: recalculateActiveIsolateId(state.activeIsolateId, action.detail)
            };

        case UPLOAD_IMPORT.SUCCEEDED:
            return {...state, importData: {...action.data, inProgress: false}};

        case SELECT_ISOLATE:
            return {...state, activeIsolateId: action.isolateId};

        case SELECT_SEQUENCE:
            return {...state, activeSequenceId: action.sequenceId};

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
