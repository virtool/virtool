import { FIND_SUBTRACTIONS, LIST_SUBTRACTION_IDS, GET_SUBTRACTION } from "../actionTypes";

const initialState = {
    documents: null,
    detail: null,
    ids: null
};

export default function subtractionsReducer (state = initialState, action) {

    switch (action.type) {

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
