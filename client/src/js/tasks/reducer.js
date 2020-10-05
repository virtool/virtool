import { GET_TASK, LIST_TASKS, WS_INSERT_TASK, WS_UPDATE_TASK } from "../app/actionTypes";
import { insert, update } from "../utils/reducers";

export const initialState = {
    documents: [],
    detail: null
};

export default function tasksReducer(state = initialState, action) {
    switch (action.type) {
        case WS_INSERT_TASK:
            return insert(state, action);

        case WS_UPDATE_TASK:
            return update(state, action);

        case LIST_TASKS.SUCCEEDED:
            return {
                ...state,
                documents: action.data
            };

        case GET_TASK.REQUESTED:
            return { ...state, detail: null };

        case GET_TASK.SUCCEEDED:
            return { ...state, detail: action.data };

        default:
            return state;
    }
}
