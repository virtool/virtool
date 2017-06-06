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
    TOGGLE_ISOLATE_EDITING,
    TOGGLE_SEQUENCE_EDITING
} from "../actionTypes";

const virusesInitialState = {
    documents: [],
    find: null,
    sort: "name",
    descending: false,
    modified: false,
    page: 1,

    detail: null,

    addingIsolate: false,
    editingIsolate: false,

    addingSequence: false,
    editingSequence: false,

    activeIsolateId: null,
    activeSequenceId: null,

    createError: "",
    createPending: false,


};

export function virusesReducer (state = virusesInitialState, action) {

    switch (action.type) {

        case WS_UPDATE_VIRUS:
            return assign({}, state, {
                viruses: concat(
                    reject(state.viruses, {virus_id: action.virus_id}),
                    assign({}, find(state.viruses, {virus_id: action.virus_id}), action.data)
                )
            });

        case WS_REMOVE_VIRUS:
            return assign({}, state, {
                viruses: reject(state.viruses, {virus_id: action.virus_id})
            });

        case FIND_VIRUSES.REQUESTED:
            return assign({}, state, assign({finding: true}, action.terms));

        case FIND_VIRUSES.SUCCEEDED:
            return assign({}, state, {
                documents: action.data,
                finding: false
            });

        case FIND_VIRUSES.FAILED:
            return assign({}, state, {
                viruses: [],
                finding: false
            });

        case GET_VIRUS.REQUESTED:
            return assign({}, state, {
                detail: null
            });

        case GET_VIRUS.SUCCEEDED:
            return assign({}, state, {
                detail: action.data,
                activeIsolateId: action.data.isolates[0].isolate_id
            });

        case CREATE_VIRUS.REQUESTED:
            return assign({}, state, {
                pending: true
            });

        case CREATE_VIRUS.FAILED:
            return assign({}, state, {
                createError: action.error
            });

        case TOGGLE_ISOLATE_EDITING:
            return assign({}, state, {
                editingIsolate: !state.editingIsolate
            });

        case TOGGLE_SEQUENCE_EDITING:
            return assign({}, state, {
                editingSequence: !state.editingSequence
            });

        default:
            return state;
    }
}
