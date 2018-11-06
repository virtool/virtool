import { WS_UPDATE_STATUS, FIND_HMMS, GET_HMM } from "../app/actionTypes";
import { updateDocuments } from "../utils/reducers";

export const initialState = {
    process: null,
    documents: null,
    page: 0,
    term: "",
    detail: null
};

export default function hmmsReducer(state = initialState, action) {
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
            return {
                ...state,
                term: action.term
            };

        case FIND_HMMS.SUCCEEDED:
            return updateDocuments(state, action);

        case GET_HMM.REQUESTED:
            return { ...state, detail: null };

        case GET_HMM.SUCCEEDED:
            return { ...state, detail: action.data };

        default:
            return state;
    }
}
