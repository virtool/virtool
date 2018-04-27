import { map, reject } from "lodash-es";
import { WS_UPDATE_JOB, WS_REMOVE_JOB, FIND_JOBS, GET_JOB, CANCEL_JOB, GET_RESOURCES } from "../actionTypes";

export const initialState = {
    documents: null,
    detail: null,
    resources: null
};

export const updateJob = (state, action) => ({
    ...state,
    documents: map(state.documents, doc => doc.id === action.data.id ? {...doc, ...action.data} : doc)
});

export default function jobsReducer (state = initialState, action) {

    switch (action.type) {

        case WS_UPDATE_JOB:
            return state.documents === null ? state : updateJob(state, action);

        case WS_REMOVE_JOB:
            return {...state, documents: reject(state.documents, {id: action.jobId})};

        case FIND_JOBS.SUCCEEDED:
            return {...state, ...action.data};

        case GET_JOB.REQUESTED:
            return {...state, detail: null};

        case GET_JOB.SUCCEEDED:
            return {...state, detail: action.data};

        case CANCEL_JOB.SUCCEEDED:
            return updateJob(state, action);

        case GET_RESOURCES.SUCCEEDED:
            return {...state, resources: action.data};

        default:
            return state;
    }
}
