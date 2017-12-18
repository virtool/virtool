import { reject } from "lodash";
import {
    WS_UPDATE_JOB,
    WS_REMOVE_JOB,
    FIND_JOBS,
    GET_JOB,
    CANCEL_JOB,
    REMOVE_JOB,
    GET_RESOURCES
} from "../actionTypes";

const initialState = {
    documents: null,
    detail: null,
    resources: null
};

const updateJob = (state, action) => ({
    ...state,
    documents: state.documents.map(doc => doc.id === action.data.id ? {...doc, ...action.data} : doc)
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

        case REMOVE_JOB.SUCCEEDED:
            return {...state, documents: reject(state.documents, {id: action.jobId})};

        case GET_RESOURCES.SUCCEEDED:
            return {...state, resources: action.data};

        default:
            return state;
    }
}
