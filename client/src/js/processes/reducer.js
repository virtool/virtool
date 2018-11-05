import { insert, update, remove } from "../utils/reducers";
import { WS_INSERT_PROCESS, WS_UPDATE_PROCESS, LIST_PROCESSES, GET_PROCESS, WS_REMOVE_PROCESS } from "../app/actionTypes";

export const initialState = {
    documents: [],
    detail: null
};

export default function processReducer(state = initialState, action) {
    switch (action.type) {
        case WS_INSERT_PROCESS:
            return insert(state, action);

        case WS_UPDATE_PROCESS:
            return update(state, action);

        case WS_REMOVE_PROCESS:
            return remove(state, action);

        case LIST_PROCESSES.SUCCEEDED:
            return {
                ...state,
                documents: action.data
            };

        case GET_PROCESS.REQUESTED:
            return { ...state, detail: null };

        case GET_PROCESS.SUCCEEDED:
            return { ...state, detail: action.data };

        default:
            return state;
    }
}
