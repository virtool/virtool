import {
    WS_UPDATE_STATUS,
    LIST_HMMS,
    GET_HMM,
    FILTER_HMMS
} from "../actionTypes";
import { updateList } from "../reducerUtils";

export const initialState = {
    process: null,
    documents: null,
    page: 0,
    detail: null,
    filter: "",
    fetched: false
};

export default function hmmsReducer (state = initialState, action) {

    switch (action.type) {

        case WS_UPDATE_STATUS:
            if (action.data.id === "hmm") {
                return {
                    ...state,
                    status: {
                        ...state.status,
                        installed: action.data.installed,
                        process: action.data.process,
                        release: action.data.release
                    }
                };
            }
            return state;

        case LIST_HMMS.REQUESTED:
            return {...state, isLoading: true, errorLoad: false};

        case LIST_HMMS.SUCCEEDED: {
            return {
                ...state,
                ...updateList(state.documents, action, state.page),
                isLoading: false,
                errorLoad: false,
                fetched: true
            };
        }

        case LIST_HMMS.FAILED:
            return {...state, isLoading: false, errorLoad: true};

        case GET_HMM.REQUESTED:
            return {...state, detail: null};

        case GET_HMM.SUCCEEDED:
            return {...state, detail: action.data};

        case FILTER_HMMS.REQUESTED:
            return {...state, filter: action.term};

        case FILTER_HMMS.SUCCEEDED: {
            return {...state, ...action.data};
        }

        default:
            return state;

    }
}
