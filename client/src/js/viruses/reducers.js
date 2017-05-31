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

    CREATE_VIRUS_SET_NAME,
    CREATE_VIRUS_SET_ABBREVIATION,
    CREATE_VIRUS_CLEAR,
    CREATE_VIRUS_REQUESTED,

    EDIT_VIRUS_REQUESTED,
    EDIT_VIRUS_FAILED,

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

    create: {
        name: "",
        abbreviation: "",
        errors: []
    },

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

        case EDIT_VIRUS_REQUESTED:
            return assign({}, state, {
                pendingEdit: true
            });

        case EDIT_VIRUS_FAILED:
            return assign({}, state, {
                pendingEdit: false
            });

        default:
            return state;
    }
}

const createVirusInitialState = {
    name: "",
    abbreviation: "",
    errors: []
};

export function createVirusReducer (state = createVirusInitialState, action) {

    switch (action.type) {

        case CREATE_VIRUS_SET_NAME:
            return assign({}, state, {
                name: action.name
            });

        case CREATE_VIRUS_SET_ABBREVIATION:
            return assign({}, state, {
                abbreviation: action.abbreviation
            });

        case CREATE_VIRUS_CLEAR:
            return assign({}, createVirusInitialState);

        case CREATE_VIRUS_REQUESTED:
            return assign({}, state, {
                pending: true
            });

    }

    return state;

}
