/**
 * Redux reducers for working with virus data.
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { assign, concat, find, reject } from "lodash";
import {
    WS_UPDATE_VIRUS,
    WS_REMOVE_VIRUS,

    FIND_VIRUSES,
    GET_VIRUS,
    CREATE_VIRUS,
    REMOVE_VIRUS,
    ADD_ISOLATE,
    EDIT_ISOLATE,
    REMOVE_ISOLATE,
    ADD_SEQUENCE,
    EDIT_SEQUENCE,
    REMOVE_SEQUENCE,
    REVERT,
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

    remove: false,
    removePending: false,

    addIsolate: false,
    addIsolatePending: false,

    editIsolate: false,
    editIsolatePending: false,

    removeIsolate: false,
    removeIsolatePending: false,

    addSequence: false,
    editSequence: false,
    removeSequence: false,

    activeIsolateId: null,
    activeSequenceId: null,

    createError: "",
    createPending: false
};

const hideVirusModal = (state) => {
    return assign({}, state, {
        remove: false,
        addIsolate: false,
        editIsolate: false,
        removeIsolate: false,
        addSequence: false,
        editSequence: false,
        removeSequence: false
    });
};

const receivedDetailAfterChange = (state, action) => {
    return assign({}, hideVirusModal(state), {
        detail: action.data
    })
};

export default function virusesReducer (state = virusesInitialState, action) {

    switch (action.type) {

        case WS_UPDATE_VIRUS:
            return assign({}, state, {
                viruses: concat(
                    reject(state.viruses, {id: action.virus_id}),
                    assign({}, find(state.viruses, {id: action.virus_id}), action.data)
                )
            });

        case WS_REMOVE_VIRUS:
            return assign({}, state, {
                viruses: reject(state.viruses, {id: action.virus_id})
            });

        case FIND_VIRUSES.REQUESTED:
            return assign({}, state, action.terms);

        case FIND_VIRUSES.SUCCEEDED:
            return assign({}, state, {
                documents: action.data.documents,
                page: action.data.page,
                pageCount: action.data.page_count,
                totalCount: action.data.total_count,
                foundCount: action.data.found_count,
                modifiedCount: action.data.modified_count
            });

        case FIND_VIRUSES.FAILED:
            return assign({}, state, {
                viruses: []
            });

        case GET_VIRUS.REQUESTED:
            return assign({}, state, {
                detail: null
            });

        case GET_VIRUS.SUCCEEDED:
            return assign({}, state, {
                detail: action.data,
                activeIsolateId: action.data.isolates.length ? action.data.isolates[0].id: null
            });

        case CREATE_VIRUS.REQUESTED:
            return assign({}, state, {
                pending: true
            });

        case CREATE_VIRUS.FAILED:
            return assign({}, state, {
                createError: action.error
            });

        case REMOVE_VIRUS.SUCCEEDED:
            return assign({}, state, {
                detail: null,
                actionIsolateId: null,
                remove: false
            });

        case ADD_ISOLATE.SUCCEEDED:
        case EDIT_ISOLATE.SUCCEEDED:
        case REMOVE_ISOLATE.SUCCEEDED:
        case ADD_SEQUENCE.SUCCEEDED:
        case EDIT_SEQUENCE.SUCCEEDED:
        case REMOVE_SEQUENCE.SUCCEEDED:
            return receivedDetailAfterChange(state, action);

        case GET_VIRUS_HISTORY.REQUESTED:
            return assign({}, state, {
                detailHistory: null
            });

        case GET_VIRUS_HISTORY.SUCCEEDED:
            return assign({}, state, {
                detailHistory: action.data
            });

        case REVERT.SUCCEEDED:
            return assign({}, state, {
                detail: action.detail,
                detailHistory: action.history
            });

        case SHOW_REMOVE_VIRUS:
            return assign({}, state, {
                removeVirus: true
            });

        case SHOW_ADD_ISOLATE:
            return assign({}, state, {
                addIsolate: true
            });

        case SHOW_EDIT_ISOLATE:
            return assign({}, state, {
                editIsolate: true
            });

        case SHOW_REMOVE_ISOLATE:
            return assign({}, state, {
                removeIsolate: true
            });

        case SHOW_ADD_SEQUENCE:
            return assign({}, state, {
                addSequence: true
            });

        case SHOW_EDIT_SEQUENCE:
            return assign({}, state, {
                editSequence: action.sequenceId
            });

        case SHOW_REMOVE_SEQUENCE:
            return assign({}, state, {
                removeSequence: action.sequenceId
            });

        case HIDE_VIRUS_MODAL:
            return hideVirusModal(state);

        default:
            return state;
    }
}
