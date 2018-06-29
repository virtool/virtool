import { map } from "lodash-es";
import {
    WS_UPDATE_SUBTRACTION,
    FIND_SUBTRACTIONS,
    LIST_SUBTRACTION_IDS,
    GET_SUBTRACTION
} from "../actionTypes";

export const initialState = {
    documents: null,
    detail: null,
    ids: null
};

export const updateList = (state, action) => ({
    ...state,
    documents: map(state.documents, doc => doc.id === action.data.id ? {...doc, ...action.data} : doc)
});

export default function subtractionsReducer (state = initialState, action) {

    switch (action.type) {

        case WS_UPDATE_SUBTRACTION:
            return state.documents === null ? state : updateList(state, action);

        case FIND_SUBTRACTIONS.SUCCEEDED:
            return {...state, ...action.data};

        case LIST_SUBTRACTION_IDS.SUCCEEDED:
            return {...state, ids: action.data};

        case GET_SUBTRACTION.REQUESTED:
            return {...state, detail: null};

        case GET_SUBTRACTION.SUCCEEDED:
            return {...state, detail: action.data};

        default:
            return state;
    }
}
