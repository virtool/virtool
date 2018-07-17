import {
    WS_INSERT_SAMPLE,
    WS_UPDATE_SAMPLE,
    WS_REMOVE_SAMPLE,
    FILTER_SAMPLES,
    LIST_SAMPLES,
    GET_SAMPLE,
    UPDATE_SAMPLE,
    REMOVE_SAMPLE,
    UPDATE_SAMPLE_RIGHTS,
    SHOW_REMOVE_SAMPLE,
    HIDE_SAMPLE_MODAL,
    FIND_READ_FILES,
    FIND_READY_HOSTS
} from "../actionTypes";
import { updateList, insert, edit, remove } from "../reducerUtils";

export const initialState = {
    documents: null,
    page: 0,
    detail: null,
    filter: "",
    fetched: false,
    refetchPage: false,
    readFiles: null,
    showEdit: false,
    showRemove: false,
    editError: false,
    reservedFiles: [],
    readyHosts: null
};

export default function samplesReducer (state = initialState, action) {

    switch (action.type) {

        case WS_INSERT_SAMPLE:
            return {
                ...state,
                documents: insert(
                    state.documents,
                    state.page,
                    state.per_page,
                    action,
                    "name"
                )
            };

        case WS_UPDATE_SAMPLE:
            return {
                ...state,
                documents: edit(state.documents, action)
            };

        case WS_REMOVE_SAMPLE:
            return {
                ...state,
                documents: remove(state.documents, action),
                refetchPage: (state.page < state.page_count)
            };

        case FILTER_SAMPLES.REQUESTED:
            return {...state, filter: action.term};

        case FILTER_SAMPLES.SUCCEEDED:
            return {...state, ...action.data};

        case LIST_SAMPLES.REQUESTED:
            return {...state, isLoading: true, errorLoad: false};

        case LIST_SAMPLES.SUCCEEDED:
            return {
                ...state,
                ...updateList(state.documents, action, state.page),
                isLoading: false,
                errorLoad: false,
                fetched: true,
                refetchPage: false
            };

        case LIST_SAMPLES.FAILED:
            return {...state, isLoading: false, errorLoad: true};

        case FIND_READ_FILES.SUCCEEDED:
            return {...state, readFiles: action.data.documents};

        case FIND_READY_HOSTS.SUCCEEDED:
            return {...state, readyHosts: action.data.documents};

        case GET_SAMPLE.REQUESTED:
            return {...state, detail: null};

        case GET_SAMPLE.SUCCEEDED:
            return {...state, detail: action.data};

        case UPDATE_SAMPLE.SUCCEEDED:
            return {...state, detail: {...state.detail, ...action.data}};

        case UPDATE_SAMPLE_RIGHTS.SUCCEEDED:
            return {...state, detail: {...state.detail, ...action.data}};

        case REMOVE_SAMPLE.SUCCEEDED:
            return {...state, detail: null};

        case SHOW_REMOVE_SAMPLE:
            return {...state, showRemove: true};

        case HIDE_SAMPLE_MODAL:
            return {...state, showRemove: false};

        default:
            return state;
    }
}
