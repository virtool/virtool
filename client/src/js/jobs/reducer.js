import {
    WS_INSERT_JOB,
    WS_UPDATE_JOB,
    WS_REMOVE_JOB,
    FIND_JOBS,
    GET_JOB,
    GET_LINKED_JOB
} from "../app/actionTypes";
import { updateDocuments, insert, update, remove } from "../utils/reducers";

export const initialState = {
    documents: null,
    term: "",
    page: 0,
    total_count: 0,
    detail: null,
    filter: "",
    fetched: false,
    linkedJobs: {}
};

export default function jobsReducer(state = initialState, action) {
    switch (action.type) {
        case WS_INSERT_JOB:
            return insert(state, action, "created_at");

        case WS_UPDATE_JOB:
            return update(state, action, "created_at");

        case WS_REMOVE_JOB:
            return remove(state, action);

        case GET_LINKED_JOB.SUCCEEDED:
            return { ...state, linkedJobs: { ...state.linkedJobs, [action.data.id]: action.data } };

        case FIND_JOBS.REQUESTED:
            return {
                ...state,
                term: action.term
            };

        case FIND_JOBS.SUCCEEDED:
            return updateDocuments(state, action, "created_at");

        case GET_JOB.REQUESTED:
            return { ...state, detail: null };

        case GET_JOB.SUCCEEDED:
            return { ...state, detail: action.data };

        default:
            return state;
    }
}
