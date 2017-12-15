/**
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import { concat, find, reject } from "lodash";
import {
    WS_UPDATE_INDEX,
    FIND_INDEXES,
    GET_INDEX,
    GET_UNBUILT,
    CREATE_INDEX,
    GET_INDEX_HISTORY,
    CLEAR_INDEX_ERROR,
    SHOW_REBUILD,
    HIDE_REBUILD
} from "../actionTypes";

const initialState = {
    documents: null,
    modifiedCount: 0,
    totalVirusCount: 0,
    error: false,
    detail: null,
    history: null,
    unbuilt: null,
    showRebuild: false
};

export default function indexesReducer (state = initialState, action) {

    switch (action.type) {

        case WS_UPDATE_INDEX:
            return {
                ...state,
                viruses: concat(
                    reject(state.documents, {index_id: action.index_id}),
                    {...find(state.documents, {index_id: action.index_id}), ...action.data}
                )
            };

        case FIND_INDEXES.SUCCEEDED:
            return {
                ...state,
                documents: action.data.documents,
                page: action.data.page,
                foundCount: action.data.found_count,
                totalCount: action.data.total_count,
                modifiedCount: action.data.modified_virus_count,
                totalVirusCount: action.data.total_virus_count
            };

        case GET_INDEX.REQUESTED:
            return {...state, detail: null};

        case GET_INDEX.SUCCEEDED:
            return {...state, detail: action.data};

        case GET_UNBUILT.REQUESTED:
            return {...state, unbuilt: null};

        case GET_UNBUILT.SUCCEEDED:
            return {...state, unbuilt: action.data};

        case CREATE_INDEX.FAILED:
            return {...state, error: true};

        case GET_INDEX_HISTORY.REQUESTED:
            return {...state, history: null};

        case GET_INDEX_HISTORY.SUCCEEDED:
            return {...state, history: action.data};

        case SHOW_REBUILD:
            return {...state, showRebuild: true};

        case HIDE_REBUILD:
            return {...state, showRebuild: false};

        case CLEAR_INDEX_ERROR:
            return {...state, error: false};

        default:
            return state;
    }
}
