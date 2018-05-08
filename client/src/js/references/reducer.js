import {
    LIST_REFERENCES,
    GET_REFERENCE,
    REMOVE_REFERENCE
} from "../actionTypes";

const initialState = {
    documents: null,
    detail: null,
    history: null
};

export default function referenceReducer (state = initialState, action) {

    switch (action.type) {

        case LIST_REFERENCES.SUCCEEDED:
            return {...state, ...action.data};

        case GET_REFERENCE.SUCCEEDED:
            return {...state, detail: action.data};

        case REMOVE_REFERENCE.SUCCEEDED:
            return {...state, detail: null};

        default:
            return state;
    }
}
