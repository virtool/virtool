import {
    WS_INSERT_INDEX,
    WS_UPDATE_INDEX,
    FIND_INDEXES,
    GET_INDEX,
    GET_UNBUILT,
    GET_INDEX_HISTORY,
    WS_INSERT_HISTORY
} from "../actionTypes";
import { updateDocuments, insert, update } from "../reducerUtils";

export const initialState = {
    documents: null,
    page: 0,
    modified_count: 0,
    total_otu_count: 0,
    detail: null,
    history: null,
    unbuilt: null,
    showRebuild: false
};

export default function indexesReducer(state = initialState, action) {
    switch (action.type) {
        case WS_INSERT_HISTORY:
            if (action.data.reference.id === state.referenceId) {
                return { ...state, modified_otu_count: state.modified_otu_count + 1 };
            }
            return state;

        case WS_INSERT_INDEX:
            if (action.data.reference.id === state.referenceId) {
                return {
                    ...insert(state, action, "version", true),
                    modified_otu_count: 0
                };
            }

            return state;

        case WS_UPDATE_INDEX:
            if (action.data.reference.id === state.referenceId) {
                return update(state, action);
            }

            return state;

        case FIND_INDEXES.REQUESTED: {
          const { term, refId } = action;
          return {
            ...state,
            term,
            refId
          };
        }

        case FIND_INDEXES.SUCCEEDED:
            return updateDocuments(state, action);

        case GET_INDEX.REQUESTED:
            return { ...state, detail: null };

        case GET_INDEX.SUCCEEDED:
            return { ...state, detail: action.data };

        case GET_UNBUILT.SUCCEEDED:
            return { ...state, unbuilt: action.data };

        case GET_INDEX_HISTORY.REQUESTED:
            return {
                ...state,
                history: {
                    ...state.history,
                    isLoading: true,
                    errorLoad: false
                }
            };

        case GET_INDEX_HISTORY.SUCCEEDED:
            return {
                ...state,
                history: {
                    ...updateDocuments(state.history, action),
                    isLoading: false,
                    errorLoad: false
                }
            };

        case GET_INDEX_HISTORY.FAILED:
            return {
                ...state,
                history: {
                    ...state.history,
                    isLoading: false,
                    errorLoad: true
                }
            };

        default:
            return state;
    }
}
