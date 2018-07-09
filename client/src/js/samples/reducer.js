import { map } from "lodash-es";
import {
    FIND_SAMPLES,
    FETCH_SAMPLES,
    GET_SAMPLE,
    UPDATE_SAMPLE,
    REMOVE_SAMPLE,
    SHOW_REMOVE_SAMPLE,
    HIDE_SAMPLE_MODAL,
    FIND_READ_FILES,
    FIND_READY_HOSTS
} from "../actionTypes";

export const initialState = {
    documents: null,
    detail: null,
    readFiles: null,
    showEdit: false,
    showRemove: false,
    editError: false,
    reservedFiles: [],
    readyHosts: null
};

export default function samplesReducer (state = initialState, action) {

    switch (action.type) {

        case FETCH_SAMPLES.REQUESTED:
            return {...state, isLoading: true, errorLoad: false};

        case FETCH_SAMPLES.SUCCEEDED:
            return {...state, ...action.data, isLoading: false, errorLoad: false};

        case FETCH_SAMPLES.FAILED:
            return {...state, isLoading: false, errorLoad: true};

        case FIND_SAMPLES.SUCCEEDED:
            return {...state, ...action.data};

        case FIND_READ_FILES.SUCCEEDED:
            return {...state, readFiles: action.data.documents};

        case FIND_READY_HOSTS.SUCCEEDED:
            return {...state, readyHosts: action.data.documents};

        case GET_SAMPLE.REQUESTED:
            return {...state, detail: null};

        case GET_SAMPLE.SUCCEEDED:
            return {...state, detail: action.data};

        case UPDATE_SAMPLE.SUCCEEDED: {
            if (state.documents === null) {
                return state;
            }

            return {...state, documents: map(state.documents, sample =>
                sample.id === action.data.id ? {...sample, ...action.data} : sample
            )};
        }

        case REMOVE_SAMPLE.SUCCEEDED:
            return {...state, detail: null, analyses: null, analysisDetail: null};

        case SHOW_REMOVE_SAMPLE:
            return {...state, showRemove: true};

        case HIDE_SAMPLE_MODAL:
            return {...state, showRemove: false};

        default:
            return state;
    }
}
