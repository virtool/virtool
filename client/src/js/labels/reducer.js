import { LIST_LABELS, REMOVE_LABEL, UPDATE_LABEL } from "../app/actionTypes";
import { updateMember } from "../utils/reducers";

export const initialState = {
    list: {}
};

export default function labelsReducer(state = initialState, action) {
    switch (action.type) {
        case LIST_LABELS.SUCCEEDED:
            return { list: action.data };
        case REMOVE_LABEL.SUCCEEDED:
            return { ...state };
        case UPDATE_LABEL.REQUESTED:
            return { ...state };
        case UPDATE_LABEL.SUCCEEDED:
            let list = state.list;
            list = updateMember(list, action);
            return { ...state, list };

        default:
            return state;
    }
}
