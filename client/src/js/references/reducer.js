import { LIST_REFS, GET_REF } from "../actionTypes";

const initialState = {
    documents: null,
    detail: null,
    history: null
};

export default function refsReducer (state = initialState, action) {

    switch (action.type) {

        case LIST_REFS.SUCCEEDED:
            return {...state, ...action.data};

        case GET_REF.SUCCEEDED:
            return {...state, detail: action.data};

        default:
            return state;
    }
}
