import { CREATE_LABEL, LIST_LABELS, REMOVE_LABEL, UPDATE_LABEL } from "../app/actionTypes";
import { insert, remove, update } from "../utils/reducers";

export const initialState = {
    documents: []
};

export default function labelsReducer(state = initialState, action) {
    switch (action.type) {
        case LIST_LABELS.SUCCEEDED:
            return { ...state, documents: action.data };

        case CREATE_LABEL.SUCCEEDED:
            return insert(state, action);

        case UPDATE_LABEL.SUCCEEDED:
            return update(state, action);

        case REMOVE_LABEL.SUCCEEDED:
            return remove(state, action);

        default:
            return state;
    }
}
