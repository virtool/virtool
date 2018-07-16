import {
    WS_INSERT_SUBTRACTION,
    WS_UPDATE_SUBTRACTION,
    WS_REMOVE_SUBTRACTION,
    LIST_SUBTRACTIONS,
    LIST_SUBTRACTION_IDS,
    GET_SUBTRACTION,
    FILTER_SUBTRACTIONS
} from "../actionTypes";
import { updateList, insert, edit, remove } from "../reducerUtils";

export const initialState = {
    documents: null,
    page: 0,
    detail: null,
    ids: null,
    filter: "",
    fetched: false,
    refetchPage: false
};

export default function subtractionsReducer (state = initialState, action) {

    switch (action.type) {

        case WS_INSERT_SUBTRACTION:
            return {
                ...state,
                documents: insert(
                    state.documents,
                    state.page,
                    state.per_page,
                    action)
            };

        case WS_UPDATE_SUBTRACTION:
            return {
                ...state,
                documents: edit(state.documents, action)
            };

        case WS_REMOVE_SUBTRACTION:
            return {
                ...state,
                documents: remove(state.documents, action),
                refetchPage: (state.page < state.page_count)
            };

        case LIST_SUBTRACTIONS.REQUESTED:
            return {...state, isLoading: true, errorLoad: false};

        case LIST_SUBTRACTIONS.SUCCEEDED: {
            return {
                ...state,
                ...updateList(state.documents, action, state.page),
                isLoading: false,
                errorLoad: false,
                fetched: true,
                refetchPage: false
            };
        }

        case LIST_SUBTRACTIONS.FAILED:
            return {...state, isLoading: false, errorLoad: true};

        case LIST_SUBTRACTION_IDS.SUCCEEDED:
            return {...state, ids: action.data};

        case GET_SUBTRACTION.REQUESTED:
            return {...state, detail: null};

        case GET_SUBTRACTION.SUCCEEDED:
            return {...state, detail: action.data};

        case FILTER_SUBTRACTIONS.REQUESTED:
            return {...state, filter: action.term};

        case FILTER_SUBTRACTIONS.SUCCEEDED: {
            return {...state, ...action.data};
        }

        default:
            return state;
    }
}
