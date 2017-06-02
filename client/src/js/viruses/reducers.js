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
    CREATE_VIRUS,

    GET_VIRUS_REQUESTED,
    GET_VIRUS_SUCCEEDED,
    GET_VIRUS_FAILED
} from "../actionTypes";

const virusesInitialState = {
    documents: [],
    find: null,
    sort: "name",
    descending: false,
    modified: false,
    page: 1,

    createError: "",
    createPending: false,

    pendingFind: false,
    pendingEdit: false,
    pendingRemove: false
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

        case GET_VIRUS_REQUESTED:
            return assign({}, state, {
                detailVisible: true
            });

        case GET_VIRUS_SUCCEEDED:
            return assign({}, state, {
                detailVisible: true,
                detailData: action.data
            });

        case GET_VIRUS_FAILED:
            return assign({}, state, {
                detailVisible: false
            });

        case CREATE_VIRUS.REQUESTED:
            return assign({}, state, {
                pending: true
            });

        case CREATE_VIRUS.FAILED:
            return assign({}, state, {
                createError: action.error
            });

        default:
            return state;
    }
}
