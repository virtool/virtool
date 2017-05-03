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

    FIND_VIRUSES_REQUESTED,
    FIND_VIRUSES_SUCCEEDED,
    FIND_VIRUSES_FAILED,

    EDIT_VIRUS_REQUESTED,
    EDIT_VIRUS_FAILED,

    GET_VIRUS_REQUESTED,
    GET_VIRUS_SUCCEEDED,
    GET_VIRUS_FAILED
} from "../actions/actionTypes";

const initialState = {
    viruses: [],
    filter: null,
    page: 1,

    detailVisible: false,
    detailData: null,

    createVisible: false,
    createData: null,

    pendingFind: false,
    pendingEdit: false,
    pendingRemove: false
};

export function virusesReducer (state = initialState, action) {

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

        case FIND_VIRUSES_REQUESTED:
            return assign({}, state, {
                viruses: [],
                finding: true
            });

        case FIND_VIRUSES_SUCCEEDED:
            return assign({}, state, {
                viruses: action.data,
                finding: false
            });

        case FIND_VIRUSES_FAILED:
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
