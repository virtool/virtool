import {
    WS_INSERT_SUBTRACTION,
    WS_UPDATE_SUBTRACTION,
    WS_REMOVE_SUBTRACTION,
    FIND_SUBTRACTIONS,
    GET_SUBTRACTION,
    UPDATE_SUBTRACTION
} from "../app/actionTypes";
import { updateDocuments, insert, update, remove } from "../utils/reducers";

export const initialState = {
    detail: null,
    documents: null,
    ids: null,
    page: 0,
    total_count: 0
};

export default function subtractionsReducer(state = initialState, action) {
    switch (action.type) {
        case WS_INSERT_SUBTRACTION:
            return insert(state, action, "id");

        case WS_UPDATE_SUBTRACTION:
            return update(state, action, "id");

        case WS_REMOVE_SUBTRACTION:
            return remove(state, action);

        case FIND_SUBTRACTIONS.REQUESTED: {
            return { ...state, term: action.term };
        }

        case FIND_SUBTRACTIONS.SUCCEEDED:
            return updateDocuments(state, action, "id");

        case LIST_SUBTRACTION_IDS.SUCCEEDED:
            return { ...state, ids: action.data };

        case GET_SUBTRACTION.REQUESTED:
            return { ...state, detail: null };

        case GET_SUBTRACTION.SUCCEEDED:
            return { ...state, detail: action.data };

        case UPDATE_SUBTRACTION.SUCCEEDED:
            return { ...state, detail: action.data };

        default:
            return state;
    }
}
