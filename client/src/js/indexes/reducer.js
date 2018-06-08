import {
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

        case FIND_INDEXES.REQUESTED:
            return {...state, isLoading: true, errorLoad: false};

        case FIND_INDEXES.SUCCEEDED:
            return {...state, ...action.data, isLoading: false, errorLoad: false};

        case FIND_INDEXES.FAILED:
            return {...state, isLoading: false, errorLoad: true};

        case GET_INDEX.REQUESTED:
            return {...state, detail: null};

        case GET_INDEX.SUCCEEDED:
            return {...state, detail: action.data};

        case GET_UNBUILT.SUCCEEDED:
            return {...state, unbuilt: action.data};

        case GET_INDEX_HISTORY.REQUESTED:
            return {...state, isLoading: true, errorLoad: false};

        case GET_INDEX_HISTORY.SUCCEEDED:
            return {...state, history: action.data, isLoading: false, errorLoad: false};

        case GET_INDEX_HISTORY.FAILED:
            return {...state, isLoading: false, errorLoad: true};

        default:
            return state;
    }
}
