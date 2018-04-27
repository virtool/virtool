import { WS_UPDATE_STATUS, FIND_HMMS, GET_HMM } from "../actionTypes";

export const initialState = {
    documents: null,
    detail: null,
    process: null
};

export default function hmmsReducer (state = initialState, action) {

    switch (action.type) {

        case WS_UPDATE_STATUS:
            if (action.data.id === "hmm_install") {
                return {
                    ...state,
                    process: action.data.process,
                    ready: action.data.ready,
                    size: action.data.download_size
                };
            }

            return state;

        case FIND_HMMS.SUCCEEDED:
            return {...state, ...action.data};

        case GET_HMM.REQUESTED:
            return {...state, detail: null};

        case GET_HMM.SUCCEEDED:
            return {...state, detail: action.data};

        default:
            return state;

    }
}
