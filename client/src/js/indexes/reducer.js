import { concat, find, reject } from "lodash-es";
import {
    WS_UPDATE_INDEX,
    FIND_INDEXES,
    GET_INDEX,
    GET_UNBUILT,
    CREATE_INDEX,
    GET_INDEX_HISTORY,
    CLEAR_INDEX_ERROR
} from "../actionTypes";

const initialState = {
    documents: null,
    modified_count: 0,
    total_virus_count: 0,
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
                documents: concat(
                    reject(state.documents, {index_id: action.index_id}),
                    {...find(state.documents, {index_id: action.index_id}), ...action.data}
                )
            };

        case FIND_INDEXES.SUCCEEDED:
            return {...state, ...action.data};

        case GET_INDEX.REQUESTED:
            return {...state, detail: null};

        case GET_INDEX.SUCCEEDED:
            return {...state, detail: action.data};

        case GET_UNBUILT.SUCCEEDED:
            return {...state, unbuilt: action.data};

        case CREATE_INDEX.FAILED:
            return {...state, error: true};

        case GET_INDEX_HISTORY.REQUESTED:
            return {...state, history: null};

        case GET_INDEX_HISTORY.SUCCEEDED:
            return {...state, history: action.data};

        case CLEAR_INDEX_ERROR:
            return {...state, error: false};

        default:
            return state;
    }
}
