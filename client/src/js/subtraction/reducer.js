import {
    FIND_SUBTRACTIONS,
    GET_SUBTRACTION,
    SHORTLIST_SUBTRACTIONS,
    EDIT_SUBTRACTION,
    WS_INSERT_SUBTRACTION,
    WS_REMOVE_SUBTRACTION,
    WS_UPDATE_SUBTRACTION
} from "../app/actionTypes";
import { insert, remove, update, updateDocuments } from "../utils/reducers";

export const initialState = {
    detail: null,
    documents: null,
    shortlist: null,
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

        case SHORTLIST_SUBTRACTIONS.SUCCEEDED:
            return { ...state, shortlist: action.data };

        case GET_SUBTRACTION.REQUESTED:
            return { ...state, detail: null };

        case GET_SUBTRACTION.SUCCEEDED:
            return { ...state, detail: action.data };

        case EDIT_SUBTRACTION.SUCCEEDED:
            return { ...state, detail: action.data };

        default:
            return state;
    }
}
