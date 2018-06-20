import { WS_UPDATE_STATUS, FIND_HMMS, GET_HMM } from "../actionTypes";

export const initialState = {
    documents: null,
    detail: null,
    process: null
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

        case FIND_HMMS.REQUESTED:
            return {...state, isLoading: true, errorLoad: false};

        case FIND_HMMS.SUCCEEDED:
            return {...state, ...action.data, isLoading: false, errorLoad: false};

        case FIND_HMMS.FAILED:
            return {...state, isLoading: false, errorLoad: true};

        case GET_HMM.REQUESTED:
            return {...state, detail: null};

        case GET_HMM.SUCCEEDED:
            return {...state, detail: action.data};

        default:
            return state;

    }
}
