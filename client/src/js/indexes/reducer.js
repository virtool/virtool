import { concat, find, reject } from "lodash-es";
import {
    WS_UPDATE_INDEX,
    FIND_INDEXES,
    GET_INDEX,
    GET_UNBUILT,
    GET_INDEX_HISTORY
} from "../actionTypes";

export const initialState = {
    documents: null,
    modified_count: 0,
    total_otu_count: 0,
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

        case GET_INDEX_HISTORY.REQUESTED:
            return {...state, history: null};

        case GET_INDEX_HISTORY.SUCCEEDED:
            return {...state, history: action.data};

        default:
            return state;
    }
}
